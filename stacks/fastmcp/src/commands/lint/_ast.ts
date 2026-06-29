/**
 * Shared, dependency-free helpers for the MCP lint checks.
 *
 * These do *line-based* parsing of Python sources (the same pragmatic approach
 * the react-fastapi BE checks use) rather than spawning a real Python AST. That
 * keeps the checks deterministic, fast, and runnable with zero Python on the
 * host. They are tuned to the conventions this stack scaffolds (see RULES.md).
 *
 * NOTE: this module lives at `lint/` level, *outside* `lint/checks/`, so the
 * tsup entry glob and the runtime loader (which treat every file under
 * `checks/<group>/` as a check) never pick it up.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'pathe'

/** The service folder that holds the Python package (analogue of `backend/`). */
export const SERVICE = 'fastmcp'

export function appDir(root: string): string {
  return path.join(root, SERVICE, 'app')
}

/** Repo-relative path under `fastmcp/app/…` (for diagnostics). */
export function appRel(...parts: string[]): string {
  return path.join(SERVICE, 'app', ...parts)
}

export function hasApp(root: string): boolean {
  return isDir(appDir(root))
}

export function isDir(p: string): boolean {
  return existsSync(p) && statSync(p).isDirectory()
}

export function isFile(p: string): boolean {
  return existsSync(p) && statSync(p).isFile()
}

export function read(p: string): string {
  return readFileSync(p, 'utf8')
}

/** Non-`__pycache__`, non-hidden subdirectory names of `dir`. */
export function listSubdirs(dir: string): string[] {
  if (!isDir(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== '__pycache__' && !e.name.startsWith('.'))
    .map((e) => e.name)
}

/** Stems of the non-`__init__` `.py` files directly in `dir`. */
export function listPyModules(dir: string): string[] {
  if (!isDir(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.py') && e.name !== '__init__.py')
    .map((e) => e.name.slice(0, -3))
}

/** Non-underscore feature package names under `features/`. */
export function featureNames(root: string): string[] {
  return listSubdirs(path.join(appDir(root), 'features')).filter((n) => !n.startsWith('_'))
}

/** Recursively visit every `.py` file under `dir`, skipping `__pycache__`. */
export function walkPy(
  dir: string,
  cb: (abs: string, rel: string) => void,
  relBase = '',
): void {
  if (!isDir(dir)) return
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name)
    const rel = relBase ? `${relBase}/${e.name}` : e.name
    if (e.isDirectory()) {
      if (e.name !== '__pycache__') walkPy(abs, cb, rel)
    } else if (e.isFile() && e.name.endsWith('.py')) {
      cb(abs, rel)
    }
  }
}

export function snakeToPascal(name: string): string {
  return name.replace(/(^|_)([a-z0-9])/g, (_m, _sep, c: string) => c.toUpperCase())
}

/** snake_case (lower, digits, underscores; must start with a letter or `_`). */
export const SNAKE_RE = /^[a-z_][a-z0-9_]*$/

// ── Python "module facts" (line-based) ─────────────────────────────────────────

export type ComponentKind = 'tool' | 'resource' | 'prompt'

export interface PyParam {
  name: string
  annotated: boolean
}

export interface DecoratedFn {
  kind: ComponentKind
  /** First string-literal argument to the decorator (resource URI), else null. */
  uri: string | null
  name: string
  isAsync: boolean
  params: PyParam[]
  /** Flattened signature text (single line), e.g. `def add(a: float) -> float:`. */
  signature: string
  hasReturnAnnotation: boolean
  hasDocstring: boolean
  /** 1-based line of the `def`. */
  line: number
  /** Approximate count of body statements (non-blank, non-comment, top body indent). */
  bodyStatements: number
  /** Raw body text (for raise/assert scans). */
  bodyText: string
  /** Whether the signature references a Context-typed `ctx` parameter. */
  hasCtxParam: boolean
}

/** Return the substring inside the first balanced `(...)` group, else ''. */
function firstParenGroup(text: string): string {
  const start = text.indexOf('(')
  if (start === -1) return ''
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) return text.slice(start + 1, i)
    }
  }
  return text.slice(start + 1)
}

function parensBalanced(text: string): boolean {
  let depth = 0
  for (const ch of text) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
  }
  return depth <= 0
}

/** Split a parameter list on top-level commas. */
function splitTopLevel(text: string): string[] {
  const out: string[] = []
  let depth = 0
  let buf = ''
  for (const ch of text) {
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    if (ch === ',' && depth === 0) {
      out.push(buf)
      buf = ''
    } else {
      buf += ch
    }
  }
  if (buf.trim()) out.push(buf)
  return out
}

function parseParams(paramText: string): PyParam[] {
  const params: PyParam[] = []
  for (const raw of splitTopLevel(paramText)) {
    const p = raw.trim()
    if (!p || p === '*' || p === '/' || p.startsWith('*')) continue
    const namePart = p.split('=')[0]!.trim() // drop default
    const name = namePart.split(':')[0]!.trim()
    if (!name) continue
    const annotated = namePart.includes(':')
    params.push({ name, annotated })
  }
  return params
}

/** Whether the first non-blank/non-comment body line opens a string literal. */
function firstStmtIsDocstring(bodyLines: string[]): boolean {
  for (const l of bodyLines) {
    const t = l.trim()
    if (t === '' || t.startsWith('#')) continue
    return /^[rRbBuU]?("""|'''|"|')/.test(t)
  }
  return false
}

/**
 * Parse a Python module's `@server.{tool,resource,prompt}`-decorated functions.
 * Handles single-line decorators (with or without args) and multi-line
 * signatures, which is all the scaffold uses.
 */
export function parseDecoratedFns(content: string): DecoratedFn[] {
  const lines = content.split('\n')
  const fns: DecoratedFn[] = []

  for (let i = 0; i < lines.length; i++) {
    const decMatch = /^\s*@server\.(tool|resource|prompt)\b(.*)$/.exec(lines[i]!)
    if (!decMatch) continue
    const kind = decMatch[1] as ComponentKind
    let uri: string | null = null

    // Collect decorator args if the decorator is called: @server.resource("…")
    const rest = (decMatch[2] ?? '').trimStart()
    if (rest.startsWith('(')) {
      let buf = rest
      let j = i
      while (!parensBalanced(buf) && j + 1 < lines.length) {
        j++
        buf += '\n' + lines[j]
      }
      const args = firstParenGroup(buf)
      const sm = /["']([^"']*)["']/.exec(args)
      uri = sm ? sm[1]! : null
      i = j
    }

    // Find the `def` / `async def` line (skip stacked decorators, comments, blanks).
    let k = i + 1
    while (k < lines.length) {
      const t = lines[k]!.trim()
      if (t === '' || t.startsWith('#') || t.startsWith('@')) {
        k++
        continue
      }
      break
    }
    const defMatch = /^(\s*)(async\s+)?def\s+([A-Za-z_]\w*)\s*\(/.exec(lines[k] ?? '')
    if (!defMatch) continue

    const defIndent = (defMatch[1] ?? '').length
    const isAsync = Boolean(defMatch[2])
    const name = defMatch[3]!

    // Collect the full signature (it may span lines until `):` / `-> …:`).
    let sig = lines[k]!
    let s = k
    while (!/\)\s*(->[^:]*)?:\s*(#.*)?$/.test(sig) && s + 1 < lines.length) {
      s++
      sig += '\n' + lines[s]
    }
    const paramText = firstParenGroup(sig)
    const params = parseParams(paramText)
    const flatSig = sig.replace(/\n/g, ' ')
    const hasReturnAnnotation = /->\s*\S+/.test(flatSig)
    const hasCtxParam =
      params.some((p) => p.name === 'ctx') || /\bctx\s*:\s*Context\b/.test(flatSig)

    // Body: subsequent lines more indented than the def.
    const bodyLines: string[] = []
    let b = s + 1
    for (; b < lines.length; b++) {
      const bl = lines[b]!
      if (bl.trim() === '') {
        bodyLines.push(bl)
        continue
      }
      const ind = bl.length - bl.trimStart().length
      if (ind <= defIndent) break
      bodyLines.push(bl)
    }

    const bodyText = bodyLines.join('\n')
    const bodyStatements = bodyLines.filter((l) => {
      const t = l.trim()
      return t !== '' && !t.startsWith('#')
    }).length

    fns.push({
      kind,
      uri,
      name,
      isAsync,
      params,
      signature: flatSig.trim(),
      hasReturnAnnotation,
      hasDocstring: firstStmtIsDocstring(bodyLines),
      line: k + 1,
      bodyStatements,
      bodyText,
      hasCtxParam,
    })
    i = Math.max(i, b - 1)
  }

  return fns
}

/** Quick presence test for any component decorator in a file's text. */
export function hasComponentDecorator(content: string): ComponentKind | null {
  const m = /@server\.(tool|resource|prompt)\b/.exec(content)
  return m ? (m[1] as ComponentKind) : null
}

/** Extract `{placeholder}` names from a resource URI literal. */
export function uriPlaceholders(uri: string): string[] {
  return [...uri.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]!.trim())
}

export const COMPONENT_PKGS = ['tools', 'resources', 'prompts'] as const

export interface ComponentModule {
  feature: string
  /** 'tools' | 'resources' | 'prompts' */
  pkg: string
  /** Module stem (file name without `.py`). */
  stem: string
  /** Repo-relative path for diagnostics. */
  rel: string
  abs: string
  content: string
  fns: DecoratedFn[]
}

/** Every component module across all features, parsed once. */
export function collectComponentModules(root: string): ComponentModule[] {
  const featuresDir = path.join(appDir(root), 'features')
  const out: ComponentModule[] = []
  for (const feature of featureNames(root)) {
    for (const pkg of COMPONENT_PKGS) {
      const pdir = path.join(featuresDir, feature, pkg)
      for (const stem of listPyModules(pdir)) {
        const abs = path.join(pdir, `${stem}.py`)
        const content = read(abs)
        out.push({
          feature,
          pkg,
          stem,
          rel: appRel('features', feature, pkg, `${stem}.py`),
          abs,
          content,
          fns: parseDecoratedFns(content),
        })
      }
    }
  }
  return out
}
