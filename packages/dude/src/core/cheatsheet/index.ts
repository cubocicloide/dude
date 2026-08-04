/**
 * Cheatsheet engine.
 *
 * One dense, answer-aware reference for the project you are standing in:
 * the commands that actually exist here, the conventions `dude lint` will
 * enforce, and the loop for verifying your own work.
 *
 * Everything is derived, never hand-written per answer combination — that is the
 * only shape that stays correct as init answers, stack versions and
 * project-local commands change.
 *
 * The primary consumer is a coding agent working inside a scaffolded project: it
 * needs one page that says what it may run and what will be checked, rather than
 * a whole documentation site to crawl. `--format json` exists for exactly that.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'pathe'
import { buildCatalog, catalogToJson, catalogToMarkdown } from '../../commands/help/index.js'
import { readDisabledCodes, PROJECT_CHECKS_DIR } from '../lint/index.js'

/** A lint rule as advertised to the reader: its code and its one-line title. */
export interface CheatsheetRule {
  code: string
  group: string
  title: string
  /** Where the rule comes from: the stack's template, or the project itself. */
  source: 'stack' | 'project'
}

export interface CheatsheetData {
  projectName?: string
  stack?: string
  stackVersion?: string
  dudeVersion?: string
  /** The init answers this project was scaffolded with. */
  answers: Record<string, unknown>
  /** Lint rules that will actually run here, code-sorted. Excludes disabled ones. */
  rules: CheatsheetRule[]
  /** Codes switched off via `dude.json` → `lint.disable`, stated not hidden. */
  disabledRules: string[]
  /** Top-level directories present in the project. */
  layout: string[]
  /** The verify loop, as concrete commands that exist in this project. */
  verify: string[]
}

const RULES_DIR = path.join('.claude', 'rules')

/**
 * Extract a rule's title from its prose file. Every rule file opens with
 * `# <CODE> — <title>` (the parity invariant in `.claude/rules/002` requires the
 * file to exist at all), so the heading is the authoritative one-liner. Falls
 * back to the bare code if a file is missing its heading.
 */
function ruleTitle(file: string, code: string): string {
  try {
    const heading = readFileSync(file, 'utf8')
      .split('\n')
      .find((l) => l.startsWith('# '))
    if (!heading) return code
    // `# BE003 — Schema class conventions` → `Schema class conventions`
    return heading
      .replace(/^#\s+/, '')
      .replace(new RegExp(`^${code}\\s*[—-]\\s*`), '')
      .trim()
  } catch {
    return code
  }
}

/**
 * The rules that will actually run against this project.
 *
 * Two sources, matching what the lint engine itself merges:
 *
 *  - the stack's prose rules under `.claude/rules/<GROUP>/<NNN>.md`;
 *  - the project's own checks under `.dude/lint/checks/<GROUP>/<id>.ts`, which
 *    run but are not required to ship a prose file.
 *
 * Codes listed in `dude.json` → `lint.disable` are **excluded**, because the
 * engine never executes them (`runLint` skips them outright). Listing a disabled
 * code here would tell a coding agent a rule is enforced when it is not — the one
 * thing this page must never do.
 */
function harvestRules(root: string): CheatsheetRule[] {
  const disabled = readDisabledCodes(root)
  const rules: CheatsheetRule[] = []
  const seen = new Set<string>()

  const scan = (dir: string, source: CheatsheetRule['source'], ext: RegExp): void => {
    if (!existsSync(dir)) return
    for (const group of readdirSync(dir, { withFileTypes: true })) {
      if (!group.isDirectory()) continue
      const groupDir = path.join(dir, group.name)
      for (const f of readdirSync(groupDir)) {
        if (!ext.test(f) || f.includes('.test.')) continue
        const id = f.replace(ext, '')
        const code = `${group.name}${id}`
        if (disabled.has(code) || seen.has(code)) continue
        seen.add(code)
        rules.push({
          code,
          group: group.name,
          title: source === 'stack' ? ruleTitle(path.join(groupDir, f), code) : code,
          source,
        })
      }
    }
  }

  scan(path.join(root, RULES_DIR), 'stack', /\.md$/)
  // Project checks are code, not prose; a co-located .md is optional, so the
  // title falls back to the bare code unless one exists next to the check.
  scan(path.join(root, PROJECT_CHECKS_DIR), 'project', /\.(ts|js|mjs|cjs)$/)

  return rules.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
}

/** Codes disabled via `dude.json` → `lint.disable`, reported rather than hidden. */
function harvestDisabled(root: string): string[] {
  return [...readDisabledCodes(root)].sort()
}

/** Top-level project directories, so an agent knows where things belong. */
function harvestLayout(root: string): string[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
      .map((e) => e.name)
      .sort()
  } catch {
    return []
  }
}

/**
 * The verify loop, built only from commands this project actually has. An agent
 * should never be told to run something the project does not expose, so each
 * step is gated on the resolved catalog.
 */
function buildVerifyLoop(flat: Set<string>, groups: Map<string, Set<string>>): string[] {
  const steps: string[] = []
  if (flat.has('format')) steps.push('dude format')
  if (flat.has('lint')) steps.push('dude lint')
  if (groups.get('api')?.has('review')) steps.push('dude api review')
  if (flat.has('test')) steps.push('dude test')
  if (flat.has('review')) steps.push('dude review')
  return steps
}

/**
 * Gather everything the cheatsheet reports.
 *
 * Accepts an already-built catalog so a caller that needs one anyway resolves the
 * stack exactly once — `buildCatalog` re-reads the stack package, re-validates its
 * manifest, and re-instantiates jiti to transpile every `.dude/commands/` file, so
 * calling it twice per render was pure waste (three times per `dude docs`).
 */
export async function collectCheatsheetData(
  cwd: string,
  prebuilt?: Awaited<ReturnType<typeof buildCatalog>>,
): Promise<CheatsheetData> {
  const { catalog } = prebuilt ?? (await buildCatalog(cwd))

  const flat = new Set(catalog.flat.keys())
  const groups = new Map(
    [...catalog.groups.entries()].map(([name, g]) => [name, new Set(g.subs.map((s) => s.name))]),
  )

  let manifest: {
    stack?: string
    stackVersion?: string
    dudeVersion?: string
    answers?: Record<string, unknown>
  } = {}
  const dudeJson = path.join(cwd, 'dude.json')
  if (existsSync(dudeJson)) {
    try {
      manifest = JSON.parse(readFileSync(dudeJson, 'utf8'))
    } catch (e) {
      // A malformed dude.json must not break the cheatsheet — the command list is
      // still useful. But it must not be silent either: without this the "This
      // project" section just vanishes and the page looks like a stack-less
      // project, which is a lie about the reason.
      process.stderr.write(
        `warning: dude.json could not be parsed (${(e as Error).message}); ` +
          `the cheatsheet will omit the project's stack and answers.\n`,
      )
    }
  }

  const answers = manifest.answers ?? {}
  return {
    projectName: typeof answers.projectName === 'string' ? answers.projectName : path.basename(cwd),
    stack: manifest.stack,
    stackVersion: manifest.stackVersion,
    dudeVersion: manifest.dudeVersion,
    answers,
    rules: harvestRules(cwd),
    disabledRules: harvestDisabled(cwd),
    layout: harvestLayout(cwd),
    verify: buildVerifyLoop(flat, groups),
  }
}

// ── Renderers ────────────────────────────────────────────────────────────────

/** Escape a value for a Markdown table cell — backslash before pipe. */
const cell = (s: string) => s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|')

function renderMarkdown(data: CheatsheetData, catalogMd: string): string {
  const out: string[] = []

  out.push(`# ${data.projectName} — cheatsheet`, '')
  out.push(
    'A single dense reference for this project: the commands that exist **here**,',
    'the conventions `dude lint` enforces, and how to verify your own work.',
    '',
    'Generated from the live command catalog and this project’s rule files, so it',
    'reflects the answers given at `dude init` and any commands you added under',
    '`.dude/commands/`. Regenerate it any time with `dude cheatsheet`.',
    '',
  )

  // ── How this project was scaffolded ────────────────────────────────────────
  const pins = [
    data.stack ? `- **Stack:** \`${data.stack}\`${data.stackVersion ? ` @ \`${data.stackVersion}\`` : ''}` : '',
    data.dudeVersion ? `- **dude:** \`${data.dudeVersion}\`` : '',
  ].filter(Boolean)
  if (pins.length || Object.keys(data.answers).length) {
    out.push('## This project', '')
    out.push(...pins)
    const answerKeys = Object.keys(data.answers).filter((k) => k !== 'projectName')
    if (answerKeys.length) {
      out.push('- **Scaffold answers:**')
      for (const k of answerKeys) {
        out.push(`    - \`${k}\` = \`${String(data.answers[k])}\``)
      }
    }
    out.push('')
  }

  // ── The verify loop — the most valuable section for an agent ───────────────
  if (data.verify.length) {
    out.push(
      '## Verify your work',
      '',
      'Run these after changing anything, in this order. They are the same checks',
      'CI runs, and every one of them exists in this project:',
      '',
      '```bash',
      ...data.verify,
      '```',
      '',
    )
  }

  // ── Conventions ───────────────────────────────────────────────────────────
  if (data.rules.length) {
    const byGroup = new Map<string, CheatsheetRule[]>()
    for (const r of data.rules) {
      const list = byGroup.get(r.group) ?? []
      list.push(r)
      byGroup.set(r.group, list)
    }
    out.push(
      '## Conventions enforced here',
      '',
      `\`dude lint\` runs **${data.rules.length} rules** in this project. Stack rules have`,
      'prose in `.claude/rules/<GROUP>/<NNN>.md` explaining why they exist and how to',
      'fix a violation — read that file before working around a diagnostic.',
      '',
    )
    for (const group of [...byGroup.keys()].sort()) {
      out.push(`### ${group}`, '', '| Code | Rule | Source |', '| ---- | ---- | ------ |')
      for (const r of byGroup.get(group)!) {
        const source = r.source === 'project' ? '`.dude/lint/checks/`' : 'stack'
        out.push(`| \`${r.code}\` | ${cell(r.title)} | ${source} |`)
      }
      out.push('')
    }
  }

  // Disabled codes are stated, not omitted: an agent that sees a rule missing
  // cannot tell "not enforced here" from "the page is out of date".
  if (data.disabledRules.length) {
    out.push(
      '### Disabled here',
      '',
      'These are switched off for this project via `dude.json` → `lint.disable`, so',
      '`dude lint` will never report them. Do not reintroduce them as conventions:',
      '',
      data.disabledRules.map((c) => `\`${c}\``).join(' · '),
      '',
    )
  }

  // ── Layout ────────────────────────────────────────────────────────────────
  if (data.layout.length) {
    out.push(
      '## Where things live',
      '',
      data.layout.map((d) => `\`${d}/\``).join(' · '),
      '',
      'The lint rules above are what pin this layout down — a file in the wrong',
      'place is a lint error, not a matter of taste.',
      '',
    )
  }

  // ── Commands ──────────────────────────────────────────────────────────────
  out.push('## Commands available here', '')
  out.push(catalogMd.replace(/^\n+/, ''))

  return out.join('\n')
}

/**
 * Render the project's cheatsheet as Markdown (default) or JSON.
 *
 * The JSON form is the agent-facing one: same data, no prose to parse.
 */
export async function generateCheatsheet(
  cwd: string,
  format: 'md' | 'json' = 'md',
): Promise<string> {
  const built = await buildCatalog(cwd)
  const { catalog, stackName } = built
  const data = await collectCheatsheetData(cwd, built)

  if (format === 'json') {
    return (
      JSON.stringify(
        {
          schema: 'dude.cheatsheet/1',
          project: data.projectName,
          stack: data.stack ?? null,
          stackVersion: data.stackVersion ?? null,
          dudeVersion: data.dudeVersion ?? null,
          answers: data.answers,
          verify: data.verify,
          layout: data.layout,
          rules: data.rules,
          disabledRules: data.disabledRules,
          catalog: JSON.parse(catalogToJson(catalog, stackName)),
        },
        null,
        2,
      ) + '\n'
    )
  }

  // standalone: false drops the page H1 and the "re-run `dude docs`" banner —
  // wrong guidance inside a cheatsheet — so no string-splicing is needed.
  return renderMarkdown(data, catalogToMarkdown(catalog, stackName, { standalone: false }))
}
