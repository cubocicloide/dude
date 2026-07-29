// ---------------------------------------------------------------------------
// Command classification — GUI-side heuristics.
//
// The stack contract deliberately does NOT carry shape metadata, so the web
// console infers a command's nature from its invocation. This is the single
// place that knowledge lives; the server annotates the catalog JSON with these
// flags and the browser just renders them (no duplicated logic client-side).
//
// Heuristics are advisory: a misclassified command still RUNS correctly, it
// just gets a less-tailored affordance. Correctness (safety gates) errs toward
// over-confirming, never under.
// ---------------------------------------------------------------------------

/** Truly interactive → out of scope for a one-way SSE console; show a "run in
 *  your terminal" card. Covers PTY/REPL commands across every stack. */
const INTERACTIVE_TOKENS = new Set(['shell', 'superuser', 'console', 'mariadb', 'bench'])

/** Destructive → needs a confirmation gate. Token-based over-gating is safe
 *  (there is no benign `destroy`/`rollback`). Covers `iac apply/bootstrap`,
 *  `security accept`, `down`, `db rollback`, `iac destroy` — the exact set the
 *  prototype's `/destroy|down|rollback/` regex missed. */
const DESTRUCTIVE_TOKENS = new Set([
  'down',
  'destroy',
  'rollback',
  'apply',
  'bootstrap',
  'accept',
  'prune',
  'reset',
])

/** Follows forever → never emits a natural `done`; show a "still streaming"
 *  pill + Stop instead of waiting for completion. */
const FOLLOWS_TOKENS = new Set(['logs', 'docs', 'dev', 'serve'])

export interface CommandFlags {
  interactive: boolean
  destructive: boolean
  follows: boolean
}

/** `invoke` is the token path: `['lint']`, `['iac', 'apply']`, `['site','console']`. */
export function classify(invoke: string[]): CommandFlags {
  const last = invoke[invoke.length - 1] ?? ''
  const interactive = INTERACTIVE_TOKENS.has(last) || isInvoke(invoke, ['iac', 'login'])
  const destructive = DESTRUCTIVE_TOKENS.has(last)
  const follows = FOLLOWS_TOKENS.has(last) || isInvoke(invoke, ['iac', 'logs'])
  return { interactive, destructive, follows }
}

/** A destructive command that is env-scoped (iac) demands a typed confirmation
 *  echoing the env — the server enforces this, not just the client. */
export function needsEnvConfirm(invoke: string[]): boolean {
  return invoke[0] === 'iac' && classify(invoke).destructive
}

function isInvoke(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i])
}

export const _sets = { INTERACTIVE_TOKENS, DESTRUCTIVE_TOKENS, FOLLOWS_TOKENS }
