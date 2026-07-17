import { defineCommand } from 'citty'
import { spawnSync } from 'node:child_process'
import { renderDiagnostics, readManifest, stackIdFromManifest } from '../../core/diagnostics.js'

/**
 * `dude report` — file a bug report about **dude itself** (the CLI or a stack)
 * against the dude repository, with `dude info` diagnostics attached
 * automatically.
 *
 * This is deliberately a *core* command, not a shipped skill or project file:
 * the target repo, the issue-form field mapping, and the diagnostics live in
 * versioned CLI code the user cannot accidentally edit or let drift. A
 * generated project only ever consumes it — it stays correct across every
 * stack and moves in lockstep with the issue form via `dude upgrade`.
 *
 * Three entry points, one capability:
 *   - AI / scripted: pass --title/--actual/… → creates via `gh` when
 *     authenticated, otherwise opens a pre-filled browser form.
 *   - Human, bare `dude report`: opens the pre-filled browser form (the GitHub
 *     issue form is the interactive UI — we don't reimplement it).
 *   - `--print`: assemble and print the report; create/open nothing.
 */

/** The upstream repo that receives dude bug reports. Overridable for forks/tests. */
const ISSUES_REPO = process.env.DUDE_ISSUES_REPO || 'cubocicloide/dude'
const NEW_ISSUE_URL = `https://github.com/${ISSUES_REPO}/issues/new`

/** Labels applied to every report (the form applies these too; gh bypasses it). */
const BASE_LABELS = ['bug', 'triage']

/** Cap the command-output field embedded in a browser URL, to keep it well under
 *  the practical URL-length ceiling. The gh path is not truncated. */
const WEB_COMMAND_MAX = 1500

interface Fields {
  title?: string
  command?: string
  expected?: string
  actual?: string
  repro?: string
  context?: string
}

/** True when `gh` is installed AND authenticated for github.com. */
function ghReady(): boolean {
  const v = spawnSync('gh', ['--version'], { stdio: 'ignore' })
  if (v.error || v.status !== 0) return false
  const a = spawnSync('gh', ['auth', 'status'], { stdio: 'ignore' })
  return !a.error && a.status === 0
}

function openBrowser(url: string): void {
  if (process.platform === 'win32') {
    spawnSync('cmd', ['/c', 'start', '', url], { stdio: 'ignore' })
    return
  }
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open'
  spawnSync(opener, [url], { stdio: 'ignore' })
}

/** Human-readable "Area" line inferred from whether we're inside a stack project. */
function areaFor(stackId: string | undefined): string {
  return stackId ? `A stack (${stackId})` : 'CLI runtime / not sure'
}

/** Assemble the Markdown body used for `gh issue create`, mirroring the issue
 *  form's sections so issues look the same however they were filed. */
export function buildBody(fields: Fields, diagnostics: string, stackId: string | undefined): string {
  const section = (heading: string, value: string | undefined, fallback = '_Not provided._') =>
    `### ${heading}\n\n${value?.trim() ? value.trim() : fallback}\n`

  const parts = [
    section('Area', areaFor(stackId)),
    section('Stack', stackId ?? 'N/A'),
    `### Diagnostics\n\n\`\`\`\n${diagnostics}\n\`\`\`\n`,
    section('Command and output', fields.command),
    section('What did you expect to happen?', fields.expected),
    section('What actually happened?', fields.actual),
    section('Steps to reproduce', fields.repro),
  ]
  if (fields.context?.trim()) parts.push(section('Additional context', fields.context))

  return parts.join('\n')
}

/** Build the pre-filled issue-form URL (browser path). GitHub issue forms accept
 *  per-field query params keyed by the field `id`. */
export function buildWebUrl(fields: Fields, diagnostics: string, stackId: string | undefined): string {
  const params = new URLSearchParams()
  params.set('template', 'bug_report.yml')
  if (fields.title) params.set('title', fields.title)
  // `stack` is a clean-id dropdown → prefills reliably. `area` options are long
  // sentences that don't round-trip through a URL, so we leave it for the user.
  if (stackId) params.set('stack', stackId)
  params.set('versions', diagnostics) // the "Diagnostics" textarea id is `versions`

  let command = fields.command
  if (command && command.length > WEB_COMMAND_MAX) {
    command = command.slice(0, WEB_COMMAND_MAX) + '\n… (truncated — paste the full output)'
  }
  if (command) params.set('command', command)
  if (fields.expected) params.set('expected', fields.expected)
  if (fields.actual) params.set('actual', fields.actual)
  if (fields.repro) params.set('repro', fields.repro)
  if (fields.context) params.set('context', fields.context)

  return `${NEW_ISSUE_URL}?${params.toString()}`
}

/** Create the issue directly via gh. Returns the issue URL, or null on failure. */
function createViaGh(title: string, body: string, labels: string[]): string | null {
  const args = ['issue', 'create', '--repo', ISSUES_REPO, '--title', title, '--body', body]
  for (const l of labels) args.push('--label', l)
  const r = spawnSync('gh', args, { encoding: 'utf8' })
  if (r.error || r.status !== 0) {
    if (r.stderr) process.stderr.write(r.stderr)
    return null
  }
  // gh prints the created issue URL on stdout.
  const url = (r.stdout || '').trim().split('\n').pop()?.trim()
  return url || null
}

export const reportCommand = defineCommand({
  meta: {
    name: 'report',
    description:
      'Report a bug in dude itself (the CLI or a stack) to the dude project. Attaches ' +
      '`dude info` diagnostics automatically and files a pre-filled issue via gh, or ' +
      'opens a pre-filled browser form. Use it when a `dude` command misbehaves — not ' +
      'for bugs in your own application code.',
  },
  args: {
    title: { type: 'string', description: 'Short summary of the problem.' },
    command: { type: 'string', description: 'The dude command you ran, plus its output/error.' },
    expected: { type: 'string', description: 'What you expected to happen.' },
    actual: { type: 'string', description: 'What actually happened.' },
    repro: { type: 'string', description: 'Steps to reproduce (newline-separated).' },
    context: { type: 'string', description: 'Any additional context.' },
    web: {
      type: 'boolean',
      description: 'Open a pre-filled issue form in the browser instead of creating it via gh.',
    },
    print: {
      type: 'boolean',
      description: 'Print the assembled report and exit; create or open nothing.',
    },
  },
  async run({ args }) {
    const cwd = process.cwd()
    const diagnostics = renderDiagnostics(cwd)
    const stackId = stackIdFromManifest(readManifest(cwd))

    const fields: Fields = {
      title: args.title as string | undefined,
      command: args.command as string | undefined,
      expected: args.expected as string | undefined,
      actual: args.actual as string | undefined,
      repro: args.repro as string | undefined,
      context: args.context as string | undefined,
    }
    const labels = [...BASE_LABELS, ...(stackId ? [`stack:${stackId}`] : [])]

    // ── --print: assemble and show, touch nothing ─────────────────────────────
    if (args.print) {
      const body = buildBody(fields, diagnostics, stackId)
      process.stdout.write(
        `Target repo: ${ISSUES_REPO}\nLabels:      ${labels.join(', ')}\n` +
          `Title:       ${fields.title ?? '(none — you must add one)'}\n\n${body}`,
      )
      return
    }

    // ── gh path: only when not forced to web, we have a title, and gh is ready ─
    if (!args.web && fields.title && ghReady()) {
      const body = buildBody(fields, diagnostics, stackId)
      const url = createViaGh(fields.title, body, labels)
      if (url) {
        process.stdout.write(`\n✓ Reported to ${ISSUES_REPO}\n  ${url}\n`)
        return
      }
      process.stderr.write(
        '\n[report] Could not create the issue via gh; opening a pre-filled browser form instead.\n',
      )
      // fall through to the web path
    }

    // ── web path: open the pre-filled issue form ──────────────────────────────
    const url = buildWebUrl(fields, diagnostics, stackId)
    if (!fields.title) {
      process.stdout.write(
        '[report] Opening a pre-filled bug report — add a title and any missing details in the form.\n',
      )
    }
    process.stdout.write(`\n  ${url}\n\n`)
    openBrowser(url)
  },
})
