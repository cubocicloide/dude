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
import { buildCatalog, catalogToJson } from '../../commands/help/index.js'

/** A lint rule as advertised to the reader: its code and its one-line title. */
export interface CheatsheetRule {
  code: string
  group: string
  title: string
}

export interface CheatsheetData {
  projectName?: string
  stack?: string
  stackVersion?: string
  dudeVersion?: string
  /** The init answers this project was scaffolded with. */
  answers: Record<string, unknown>
  /** Lint rules shipped for this project, grouped by area, code-sorted. */
  rules: CheatsheetRule[]
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

function harvestRules(root: string): CheatsheetRule[] {
  const dir = path.join(root, RULES_DIR)
  if (!existsSync(dir)) return []
  const rules: CheatsheetRule[] = []
  for (const group of readdirSync(dir, { withFileTypes: true })) {
    if (!group.isDirectory()) continue
    const groupDir = path.join(dir, group.name)
    for (const f of readdirSync(groupDir)) {
      if (!f.endsWith('.md')) continue
      const code = `${group.name}${path.basename(f, '.md')}`
      rules.push({ code, group: group.name, title: ruleTitle(path.join(groupDir, f), code) })
    }
  }
  return rules.sort((a, b) => a.code.localeCompare(b.code))
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

export async function collectCheatsheetData(cwd: string): Promise<CheatsheetData> {
  const { catalog } = await buildCatalog(cwd)

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
    } catch {
      // A malformed dude.json must not break the cheatsheet — the command list
      // is still useful, and `dude info` is the place that diagnoses config.
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
    layout: harvestLayout(cwd),
    verify: buildVerifyLoop(flat, groups),
  }
}

// ── Renderers ────────────────────────────────────────────────────────────────

/** Escape a value for a Markdown table cell — backslash before pipe. */
const cell = (s: string) => s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|')

/**
 * Splice the catalog's command reference into this page.
 *
 * `catalogToMarkdown` renders a standalone page: an H1, then a banner telling the
 * reader to re-run `dude docs` to refresh it. Both are wrong inside a cheatsheet —
 * the banner would hand an agent the wrong refresh command — so keep only the
 * body after the catalog's own `## Commands` heading.
 */
function embedCatalog(catalogMd: string): string {
  const marker = '\n## Commands\n'
  const at = catalogMd.indexOf(marker)
  if (at === -1) {
    // Renderer changed shape; fall back to dropping just the H1 rather than
    // silently emitting nothing.
    return catalogMd.replace(/^# .*\n/, '').replace(/^\n+/, '')
  }
  return catalogMd.slice(at + marker.length).replace(/^\n+/, '')
}

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
      `\`dude lint\` checks **${data.rules.length} rules**. Each one has prose in`,
      '`.claude/rules/<GROUP>/<NNN>.md` explaining why it exists and how to fix a',
      'violation — read that file before working around a diagnostic.',
      '',
    )
    for (const group of [...byGroup.keys()].sort()) {
      out.push(`### ${group}`, '', '| Code | Rule |', '| ---- | ---- |')
      for (const r of byGroup.get(group)!) {
        out.push(`| \`${r.code}\` | ${cell(r.title)} |`)
      }
      out.push('')
    }
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
  out.push(embedCatalog(catalogMd))

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
  const data = await collectCheatsheetData(cwd)
  const { catalog, stackName } = await buildCatalog(cwd)

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
          catalog: JSON.parse(catalogToJson(catalog, stackName)),
        },
        null,
        2,
      ) + '\n'
    )
  }

  const { catalogToMarkdown } = await import('../../commands/help/index.js')
  return renderMarkdown(data, catalogToMarkdown(catalog, stackName))
}
