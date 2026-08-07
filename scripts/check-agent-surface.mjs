/**
 * Enforce `.claude/rules/006-agent-surface.md`.
 *
 * Two checks, both of which were cultural until this script existed:
 *
 * 1. **The minimum surface.** Every stack ships the same baseline under
 *    `templates/base/` — tasks.json, an issue-fixer agent, the stack-agnostic
 *    workflow skills, at least one `create-*`, a `create` router once there is
 *    more than one. Nothing breaks when these are missing, which is precisely how
 *    the surface drifted to two stacks out of six (#108, #134).
 *
 * 2. **Skills only name commands that exist.** The failure mode that makes an
 *    agent surface worse than none: a skill copied from another stack telling the
 *    agent to run `dude security scan` on a stack with no `security` group. The
 *    agent wastes a turn and then improvises — exactly the guesswork the surface
 *    is supposed to remove. Commands are read from each stack's compiled
 *    `definition.commands`, so this cannot drift from what actually runs.
 *
 * Run via `make agent-surface-check` (and from `ci.yml`, which already builds).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Reference copy of the shared lint-watch task — every stack must match it. */
const TASKS_REFERENCE = path.join(
  REPO,
  'stacks/react-fastapi/templates/base/.vscode/tasks.json',
)

function loadRegistry() {
  const { stacks } = JSON.parse(
    readFileSync(path.join(REPO, 'packages', 'dude', 'registry.json'), 'utf8'),
  )
  return Object.keys(stacks).sort()
}

async function loadDefinition(id) {
  const dist = path.join(REPO, 'stacks', id, 'dist', 'index.js')
  if (!existsSync(dist)) {
    throw new Error(
      `Stack "${id}" has not been built: ${path.relative(REPO, dist)} is missing.\n` +
        `This check reads each stack's compiled definition. Run \`make build\` first.\n`,
    )
  }
  const mod = await import(pathToFileURL(dist).href)
  if (!mod.default?.name) throw new Error(`Stack "${id}" does not default-export a definition.`)
  return mod.default
}

/** Core command names, from the CLI's own catalog rather than a second list here. */
async function coreCommandNames() {
  const { generateApiDoc } = await import(
    pathToFileURL(path.join(REPO, 'packages', 'dude', 'dist', 'index.js')).href
  )
  // The repo root has no dude.json, so the catalog resolves to core-only.
  return new Set(JSON.parse(await generateApiDoc(REPO, 'json')).commands.map((c) => c.name))
}

/** `{ flat: Set<name>, groups: Map<group, Set<sub>> }` from a stack definition. */
function commandSurface(definition) {
  const flat = new Set()
  const groups = new Map()
  for (const [name, entry] of Object.entries(definition.commands ?? {})) {
    if (entry && typeof entry === 'object' && typeof entry.run === 'function') {
      flat.add(name)
    } else if (entry && typeof entry === 'object') {
      groups.set(name, new Set(Object.keys(entry)))
    }
  }
  return { flat, groups }
}

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) walkFiles(full, out)
    else out.push(full)
  }
  return out
}

/**
 * Every `dude <command>` (optionally `<group> <sub>`) a skill tells the agent to run.
 *
 * Only `dude` in **command position** counts — inside a fenced code block or an
 * inline code span. Scanning raw prose instead flags the word in ordinary
 * sentences: "are you inside a dude project?" reads as `dude project`, and every
 * skill opens with that line.
 *
 * Only lowercase tokens count as a command name, which conveniently skips
 * placeholders (`dude explain <CODE>`) and arguments (`dude explain BE003`)
 * without needing to special-case them.
 */
function referencedCommands(text) {
  const refs = []
  const add = (line) => {
    // Tolerate a shell prompt and leading whitespace before the command.
    const m = /^\s*(?:\$\s+)?dude\s+([a-z][a-z0-9-]*)(?:\s+([a-z][a-z0-9-]*))?/.exec(line)
    if (m) refs.push({ cmd: m[1], sub: m[2] })
  }

  // Fenced code blocks, line by line.
  const fences = /```[^\n]*\n([\s\S]*?)```/g
  let f
  while ((f = fences.exec(text)) !== null) {
    for (const line of f[1].split('\n')) add(line)
  }

  // Inline code spans, outside the fenced blocks (which are stripped first so a
  // fence's contents are not re-scanned as one giant span).
  const prose = text.replace(fences, '')
  const spans = /`([^`\n]+)`/g
  let s
  while ((s = spans.exec(prose)) !== null) add(s[1])

  return refs
}

const problems = []
const note = (stack, message) => problems.push(`${stack}: ${message}`)

const core = await coreCommandNames()
const reference = existsSync(TASKS_REFERENCE) ? readFileSync(TASKS_REFERENCE, 'utf8') : null

for (const id of loadRegistry()) {
  const base = path.join(REPO, 'stacks', id, 'templates', 'base')
  if (!existsSync(base)) {
    note(id, 'has no templates/base/ directory')
    continue
  }

  const definition = await loadDefinition(id)
  const { flat, groups } = commandSurface(definition)

  // ── 1. The minimum surface ────────────────────────────────────────────────
  const required = [
    '.vscode/tasks.json',
    '.claude/agents/issue-fixer.md',
    '.claude/skills/clean-branches/SKILL.md',
    '.claude/skills/fix-issues/SKILL.md',
    '.dude/lint/checks/PRJ/001.ts',
    '.dude/lint/checks/PRJ/001.md',
  ]
  for (const rel of required) {
    if (!existsSync(path.join(base, rel))) note(id, `missing ${rel}`)
  }

  const skillsDir = path.join(base, '.claude', 'skills')
  const skills = existsSync(skillsDir)
    ? readdirSync(skillsDir).filter((s) => existsSync(path.join(skillsDir, s, 'SKILL.md')))
    : []
  const creates = skills.filter((s) => s.startsWith('create-'))
  if (creates.length === 0) {
    note(id, 'ships no `create-*` skill — every stack needs at least one per primary artifact')
  }
  if (creates.length > 1 && !skills.includes('create')) {
    note(id, `has ${creates.length} create-* skills but no \`create\` router skill`)
  }

  // The security trio belongs exactly where the command group exists.
  const hasSecurity = flat.has('security') || groups.has('security')
  for (const rel of [
    '.claude/agents/security-fixer.md',
    '.claude/skills/security-scan/SKILL.md',
    '.claude/skills/verify-security-fixes/SKILL.md',
  ]) {
    const present = existsSync(path.join(base, rel))
    if (hasSecurity && !present) note(id, `registers \`security\` but is missing ${rel}`)
    if (!hasSecurity && present) {
      note(id, `ships ${rel} but registers no \`security\` command group`)
    }
  }

  // tasks.json is shared, not per-stack: a variant is drift, not customisation.
  const tasks = path.join(base, '.vscode', 'tasks.json')
  if (reference && existsSync(tasks) && readFileSync(tasks, 'utf8') !== reference) {
    note(id, '.vscode/tasks.json differs from the shared reference copy')
  }

  // ── 2. Skills may only name commands that exist ───────────────────────────
  const surfaceFiles = [
    ...walkFiles(path.join(base, '.claude', 'skills')),
    ...walkFiles(path.join(base, '.claude', 'agents')),
  ].filter((f) => f.endsWith('.md'))

  for (const file of surfaceFiles) {
    const rel = path.relative(base, file)
    const seen = new Set()
    for (const { cmd, sub } of referencedCommands(readFileSync(file, 'utf8'))) {
      const known = core.has(cmd) || flat.has(cmd) || groups.has(cmd)
      if (!known) {
        const key = `${rel}::${cmd}`
        if (!seen.has(key)) {
          seen.add(key)
          note(id, `${rel} references \`dude ${cmd}\`, which this stack does not register`)
        }
        continue
      }
      if (sub && groups.has(cmd) && !groups.get(cmd).has(sub)) {
        const key = `${rel}::${cmd} ${sub}`
        if (!seen.has(key)) {
          seen.add(key)
          note(id, `${rel} references \`dude ${cmd} ${sub}\`, but \`${cmd}\` has no \`${sub}\` subcommand`)
        }
      }
    }
  }
}

if (problems.length) {
  process.stderr.write(
    `\nAgent-surface check failed (${problems.length} problem${problems.length > 1 ? 's' : ''}):\n\n` +
      problems.map((p) => `  - ${p}`).join('\n') +
      `\n\nSee .claude/rules/006-agent-surface.md.\n`,
  )
  process.exit(1)
}

process.stdout.write('  \x1b[32m✓\x1b[0m  Agent surface is complete and references only real commands.\n')
