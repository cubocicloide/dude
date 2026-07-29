import { spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'

// ---------------------------------------------------------------------------
// Run registry — the heart of the GUI's process lifecycle.
//
// A `Run` is a spawned `dude <argv>` whose lifetime is DECOUPLED from any HTTP
// request. Output flows into a bounded ring buffer whether or not anyone is
// listening, so a command survives the client navigating away, refreshing, or
// disconnecting. Viewers attach/re-attach over SSE and replay the buffer; the
// run only dies when it exits or someone explicitly kills it.
//
// This is the fix for the prototype's fatal flaw (`req.on('close') → kill`),
// which killed `logs -f` / `up` / dev servers the instant a tab closed.
// ---------------------------------------------------------------------------

/** One captured output line with a monotonic sequence number (for SSE replay). */
export interface RunLine {
  seq: number
  text: string
}

export type RunStatus = 'running' | 'exited' | 'killed'

/** An event pushed to subscribers: a new output line, or terminal completion. */
export type RunEvent =
  | { type: 'out'; seq: number; text: string }
  | { type: 'done'; status: RunStatus; code: number | null }

type Subscriber = (ev: RunEvent) => void

export interface Run {
  id: string
  cwd: string
  argv: string[]
  startedAt: number
  endedAt: number | null
  status: RunStatus
  exitCode: number | null
  /** Ring buffer of the most recent lines (older lines are dropped). */
  lines: RunLine[]
  /** Monotonic line counter — keeps climbing even after the buffer trims. */
  private_seq: number
  child: ChildProcess | null
  subscribers: Set<Subscriber>
}

/** Public, JSON-safe view of a run (no child handle, no subscribers). */
export interface RunSummary {
  id: string
  cwd: string
  argv: string[]
  startedAt: number
  endedAt: number | null
  status: RunStatus
  exitCode: number | null
}

const MAX_LINES = 5000
// eslint-disable-next-line no-control-regex — strip color + cursor codes; NO_COLOR
// silences color but not the cursor moves clack/spinners emit, which render as
// garbage in a browser <pre>.
const ANSI = /\x1b\[[0-9;?]*[a-zA-Z]/g

export class RunRegistry {
  private runs = new Map<string, Run>()

  /**
   * Spawn a process in `cwd`, detached from any request. `file`/`args` is the
   * real argv passed to `spawn` (always an array — never a shell string), while
   * `label` is the human-facing invocation shown in the UI/history (e.g. the
   * `dude` subcommand, not `node /abs/cli.js …`).
   */
  start(cwd: string, file: string, args: string[], label: string[]): Run {
    const child = spawn(file, args, {
      cwd,
      // NO_COLOR keeps most ANSI out; we strip the rest so the browser <pre>
      // stays clean. Never a shell string — argv array only (injection-safe).
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    })

    const run: Run = {
      id: randomUUID(),
      cwd,
      argv: label,
      startedAt: Date.now(),
      endedAt: null,
      status: 'running',
      exitCode: null,
      lines: [],
      private_seq: 0,
      child,
      subscribers: new Set(),
    }
    this.runs.set(run.id, run)

    // ponytail: chunk-split, not a full line buffer — a line straddling two
    // chunks renders as two lines. Cosmetic; upgrade to readline if it bites.
    const pipe = (buf: Buffer) => {
      const parts = buf.toString().replace(ANSI, '').split('\n')
      parts.forEach((text, i) => {
        if (i === parts.length - 1 && text === '') return
        this.append(run, text)
      })
    }
    child.stdout?.on('data', pipe)
    child.stderr?.on('data', pipe)

    child.on('close', (code) => this.finish(run, code ?? 0, 'exited'))
    child.on('error', (err) => {
      this.append(run, `[spawn error] ${err.message}`)
      this.finish(run, 1, 'exited')
    })

    return run
  }

  private append(run: Run, text: string): void {
    const line: RunLine = { seq: run.private_seq++, text }
    run.lines.push(line)
    if (run.lines.length > MAX_LINES) run.lines.shift()
    this.broadcast(run, { type: 'out', seq: line.seq, text })
  }

  private finish(run: Run, code: number, status: RunStatus): void {
    if (run.status !== 'running') return
    run.status = status
    run.exitCode = code
    run.endedAt = Date.now()
    run.child = null
    this.broadcast(run, { type: 'done', status, code })
  }

  private broadcast(run: Run, ev: RunEvent): void {
    for (const fn of run.subscribers) {
      try {
        fn(ev)
      } catch {
        // a broken subscriber must never crash the run or other viewers
      }
    }
  }

  get(id: string): Run | undefined {
    return this.runs.get(id)
  }

  list(): RunSummary[] {
    return [...this.runs.values()].map(summarize)
  }

  /**
   * Attach a subscriber. Immediately replays buffered lines with `seq > afterSeq`
   * (SSE `Last-Event-ID` reconnect), then live-streams; if the run already
   * finished, replays the tail and emits its terminal `done`. Returns an
   * unsubscribe fn — call it on client disconnect (does NOT kill the run).
   */
  subscribe(run: Run, afterSeq: number, fn: Subscriber): () => void {
    for (const line of run.lines) {
      if (line.seq > afterSeq) fn({ type: 'out', seq: line.seq, text: line.text })
    }
    if (run.status !== 'running') {
      fn({ type: 'done', status: run.status, code: run.exitCode })
      return () => {}
    }
    run.subscribers.add(fn)
    return () => run.subscribers.delete(fn)
  }

  /** Explicit cancel: SIGTERM, escalating to SIGKILL after a grace period. */
  kill(id: string): boolean {
    const run = this.runs.get(id)
    if (!run || run.status !== 'running' || !run.child) return false
    const child = run.child
    child.kill('SIGTERM')
    const t = setTimeout(() => {
      if (run.status === 'running') child.kill('SIGKILL')
    }, 4000)
    t.unref?.()
    // The 'close' handler flips status; mark intent so it reports as killed.
    child.once('close', () => this.finish(run, run.exitCode ?? 130, 'killed'))
    return true
  }

  /** Drop a finished run's record + buffer. No-op if still running. */
  remove(id: string): boolean {
    const run = this.runs.get(id)
    if (!run || run.status === 'running') return false
    return this.runs.delete(id)
  }

  /** Kill every managed child — call on server shutdown (runs are session-scoped). */
  killAll(): void {
    for (const run of this.runs.values()) run.child?.kill('SIGKILL')
  }
}

function summarize(run: Run): RunSummary {
  return {
    id: run.id,
    cwd: run.cwd,
    argv: run.argv,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    status: run.status,
    exitCode: run.exitCode,
  }
}
