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
import { discoverCheckCodes } from '../lint/index.js'

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
  /**
   * Codes claimed twice (stack and project). `runLint` treats this as fatal and
   * runs NOTHING, so it must be reported — not silently resolved in favour of one.
   */
  collisions: string[]
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
 * Derived from `discoverCheckCodes` — the engine's own discovery — so this page and
 * `dude lint` can never disagree. `.claude/rules/<GROUP>/<NNN>.md` supplies only the
 * human title; a missing prose file degrades to the bare code rather than dropping
 * an enforced rule, and a stray prose file with no check behind it is ignored.
 *
 * Reading that prose directory as the source of *codes* was the bug: it is a
 * separate, independently-mutable tree (`dude upgrade --stack` does not migrate
 * files), so it drifted in both directions.
 */
function harvestRules(root: string, stackRoot: string, disabled: Set<string>): CheatsheetRule[] {
  const { codes } = discoverCheckCodes(root, stackRoot)
  return codes
    .filter((c) => !disabled.has(c.code))
    .map((c) => ({
      code: c.code,
      group: c.group,
      title:
        c.source === 'stack'
          ? ruleTitle(path.join(root, RULES_DIR, c.group, `${c.id}.md`), c.code)
          : c.code,
      source: c.source,
    }))
}

/**
 * Lint facts for the page. Without a resolved stack root the engine cannot be
 * consulted, so report nothing rather than guessing from the prose directory —
 * an empty list is honest, an invented one is not.
 */
function harvestLintFacts(
  root: string,
  stackRoot: string | undefined,
): Pick<CheatsheetData, 'rules' | 'disabledRules' | 'collisions'> {
  if (!stackRoot) return { rules: [], disabledRules: [], collisions: [] }
  const { disabled, collisions } = discoverCheckCodes(root, stackRoot)
  return {
    rules: harvestRules(root, stackRoot, disabled),
    disabledRules: [...disabled].sort(),
    collisions,
  }
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
  stackRoot?: string,
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
    ...harvestLintFacts(cwd, stackRoot),
    layout: harvestLayout(cwd),
    verify: buildVerifyLoop(flat, groups),
  }
}

/**
 * Best-effort stack root for a project, so the library entry point can consult the
 * engine without the caller threading it. A project whose stack cannot resolve
 * simply reports no lint facts (see `harvestLintFacts`).
 */
async function resolveStackRoot(cwd: string): Promise<string | undefined> {
  const dudeJsonPath = path.join(cwd, 'dude.json')
  if (!existsSync(dudeJsonPath)) return undefined
  try {
    const { stack, stackVersion } = JSON.parse(readFileSync(dudeJsonPath, 'utf8')) as {
      stack?: string
      stackVersion?: string
    }
    if (!stack) return undefined
    const { loadStack } = await import('../stack-loader.js')
    return (await loadStack(stack, cwd, stackVersion)).root
  } catch {
    // Already reported by whoever owns the failure; absent lint facts are honest.
    return undefined
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
  stackRoot?: string,
): Promise<string> {
  const built = await buildCatalog(cwd)
  const { catalog, stackName } = built
  // The stack root is where the engine finds the compiled checks. Callers that
  // already have it (the `cheatsheet`/`docs` commands) pass it; otherwise resolve
  // it here so the library entry point behaves the same.
  const root = stackRoot ?? (await resolveStackRoot(cwd))
  const data = await collectCheatsheetData(cwd, built, root)

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
          collisions: data.collisions,
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
