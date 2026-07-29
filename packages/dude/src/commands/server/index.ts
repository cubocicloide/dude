import { defineCommand } from 'citty'
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import os from 'node:os'
import path from 'pathe'
import { consola } from 'consola'
import { buildCatalog, catalogToJson } from '../help/index.js'
import { loadRegistry, resolveStackSpec } from '../../core/registry.js'
import { loadStack } from '../../core/stack-loader.js'
import { getPackageRoot } from '../../utils/paths.js'
import { RunRegistry } from './registry.js'
import { classify, needsEnvConfirm } from './classify.js'
import { renderPage } from './page.js'

// ---------------------------------------------------------------------------
// `dude server` — a local, single-user web app that manages every dude project
// on this machine: list them, scaffold new ones, and open a per-project console
// that runs any stack command and streams its output.
//
// Introspection drives the UI end to end — stacks declare their scaffold
// questions (`definition.variables`) and their commands (`buildCatalog`), so
// both the create form and the console generate themselves. No per-stack or
// per-command wiring: a new stack/command appears in the GUI for free.
//
// SECURITY. This spawns arbitrary project commands, so it is RCE if reached by
// anyone but the local user. Defenses (all preserved below):
//   1. Bind 127.0.0.1 only — never 0.0.0.0, no --host flag.
//   2. Reject any request whose Host header isn't 127.0.0.1/localhost (a random
//      loopback port is NOT access control — a page you visit can fire
//      cross-origin requests at it; the Host check defeats DNS-rebind).
//   3. A per-session secret token, injected into the served page and required
//      on every /api/* request (a drive-by page can't read it → can't call us).
//   4. Spawn with an argv array, never a shell string.
//   5. Any cwd/path must be a REGISTERED project (or the home dir) — never an
//      arbitrary filesystem path.
//   6. Command output is rendered with textContent only (no innerHTML).
// ---------------------------------------------------------------------------

// ── Project store (~/.dude/projects.json) ──────────────────────────────────

interface ProjectRecord {
  path: string
  addedAt?: string
}

const DUDE_HOME = path.join(os.homedir(), '.dude')
const PROJECTS_FILE = path.join(DUDE_HOME, 'projects.json')

function readProjects(): ProjectRecord[] {
  try {
    const raw = JSON.parse(readFileSync(PROJECTS_FILE, 'utf8')) as ProjectRecord[]
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function writeProjects(list: ProjectRecord[]): void {
  mkdirSync(DUDE_HOME, { recursive: true })
  writeFileSync(PROJECTS_FILE, JSON.stringify(list, null, 2) + '\n', 'utf8')
}

function addProject(projectPath: string): void {
  const abs = path.resolve(projectPath)
  const list = readProjects()
  if (!list.some((p) => path.resolve(p.path) === abs)) {
    list.push({ path: abs, addedAt: new Date().toISOString() })
    writeProjects(list)
  }
}

function removeProject(projectPath: string): void {
  const abs = path.resolve(projectPath)
  writeProjects(readProjects().filter((p) => path.resolve(p.path) !== abs))
}

/** Is `p` a path we're allowed to spawn/read in? Registered project or home. */
function isAllowedCwd(p: string): boolean {
  const abs = path.resolve(p)
  if (abs === path.resolve(os.homedir())) return true
  return readProjects().some((r) => path.resolve(r.path) === abs)
}

/** Enrich a stored path with what's on disk: does it exist, name, stack. */
function describeProject(p: ProjectRecord) {
  const dudeJsonPath = path.join(p.path, 'dude.json')
  let exists = false
  let stack: string | null = null
  let name = path.basename(p.path)
  if (existsSync(dudeJsonPath)) {
    exists = true
    try {
      const meta = JSON.parse(readFileSync(dudeJsonPath, 'utf8')) as {
        stack?: string
        answers?: { projectName?: string }
      }
      stack = meta.stack ?? null
      if (meta.answers?.projectName) name = meta.answers.projectName
    } catch {
      // keep defaults
    }
  }
  return { path: p.path, name, stack, exists }
}

// ── Project resolution ───────────────────────────────────────────────────────
// `buildCatalog` is the source of truth (it resolves the stack exactly like the
// CLI: node_modules → workspace scan → cache). We derive the provisioning state
// from its RESULT so an in-repo scaffold (resolved via workspace scan) reports
// `ok` even though it isn't in the project's own node_modules.
//
// ponytail: a genuinely external, uninstalled project makes buildCatalog fall
// back to a one-time ~/.dude cache install (the CLI's existing behavior) — the
// "avoid that network hop for a pure status check" enhancement is deferred.

type StackStatus = 'ok' | 'needs-install' | 'needs-build' | 'no-stack'

const CORE_NAMES = new Set(['init', 'upgrade', 'version', 'help', 'info', 'report', 'server'])

function declaredStack(projectPath: string): string | undefined {
  try {
    return (JSON.parse(readFileSync(path.join(projectPath, 'dude.json'), 'utf8')) as { stack?: string })
      .stack
  } catch {
    return undefined
  }
}

function hasWorkspaceAbove(dir: string): boolean {
  let cur = path.resolve(dir)
  for (;;) {
    if (existsSync(path.join(cur, 'pnpm-workspace.yaml'))) return true
    const parent = path.dirname(cur)
    if (parent === cur) return false
    cur = parent
  }
}

interface CatalogJson {
  commands: { name: string }[]
  groups: { name: string; subcommands: { name: string }[] }[]
  projectCommands: { name: string }[]
}

/** dude.json declares a stack but the catalog carries none of its commands. */
function stackFailedToLoad(projectPath: string, cat: CatalogJson): boolean {
  if (!declaredStack(projectPath)) return false
  const hasStackFlat = cat.commands.some((c) => !CORE_NAMES.has(c.name))
  return !hasStackFlat && cat.groups.length === 0
}

/** Tag every command with GUI-side shape flags so the browser renders the right
 *  affordance without re-implementing the heuristics. */
function annotateCatalog(cat: CatalogJson, stackStatus: StackStatus): unknown {
  const tag = (invoke: string[]) => classify(invoke)
  return {
    ...cat,
    stackStatus,
    commands: cat.commands.map((c) => ({ ...c, flags: tag([c.name]) })),
    groups: cat.groups.map((g) => ({
      ...g,
      subcommands: g.subcommands.map((s) => ({ ...s, flags: tag([g.name, s.name]) })),
    })),
    projectCommands: cat.projectCommands.map((c) => ({ ...c, flags: tag([c.name]) })),
  }
}

// ── argv helpers ─────────────────────────────────────────────────────────────

/** Leading non-flag tokens of a `dude` argv: `['iac','apply','--env','x'] → ['iac','apply']`. */
function extractInvoke(argv: string[]): string[] {
  const out: string[] = []
  for (const t of argv) {
    if (t.startsWith('-')) break
    out.push(t)
  }
  return out
}

function flagValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`)
  return i !== -1 ? argv[i + 1] : undefined
}

// ── HTTP plumbing ────────────────────────────────────────────────────────────

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'))
      } catch {
        resolve({})
      }
    })
  })
}

/** DNS-rebind guard: the Host header's hostname must be loopback. */
function hostOk(req: IncomingMessage): boolean {
  const host = (req.headers.host ?? '').split(':')[0]
  return host === '127.0.0.1' || host === 'localhost'
}

function tokenOk(req: IncomingMessage, url: URL, token: string): boolean {
  const header = req.headers['x-dude-token']
  const provided = (typeof header === 'string' ? header : null) ?? url.searchParams.get('token')
  return provided === token
}

/** Best-effort: open the default browser. Never throws. */
function openBrowser(url: string): void {
  const cmd =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  try {
    const child = spawn(cmd, [url], {
      stdio: 'ignore',
      detached: true,
      shell: process.platform === 'win32',
    })
    child.on('error', () => {})
    child.unref()
  } catch {
    // ignore — the URL is printed, the user can open it manually
  }
}

// ── Server factory ───────────────────────────────────────────────────────────

export type DudeServer = Server & { dudeToken: string; runs: RunRegistry }

/** Build the (non-listening) HTTP server. Exported for tests. */
export function createDudeServer(binPath: string): DudeServer {
  const token = randomUUID()
  const runs = new RunRegistry()
  const server = createServer((req, res) => {
    void handle(req, res, binPath, token, runs).catch((err) => {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end('server error: ' + (err as Error).message)
    })
  }) as DudeServer
  server.dudeToken = token
  server.runs = runs
  return server
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  binPath: string,
  token: string,
  runs: RunRegistry,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  const p = url.pathname

  if (!hostOk(req)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    res.end('forbidden host')
    return
  }

  // The page itself carries the token to the browser; everything else needs it.
  if (p === '/' || p === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(renderPage(token))
    return
  }

  if (!tokenOk(req, url, token)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    res.end('forbidden')
    return
  }

  // ── Stacks + variables (drive the create form) ─────────────────────────────
  if (p === '/api/stacks') {
    try {
      const registry = await loadRegistry(getPackageRoot())
      sendJson(res, 200, { stacks: Object.keys(registry.stacks), home: os.homedir() })
    } catch (err) {
      sendJson(res, 500, { error: (err as Error).message })
    }
    return
  }

  if (p === '/api/stack-variables') {
    const stackName = url.searchParams.get('stack') ?? ''
    try {
      const registry = await loadRegistry(getPackageRoot())
      const { spec } = resolveStackSpec(registry, stackName)
      const { definition } = await loadStack(spec, os.homedir())
      sendJson(res, 200, definition.variables ?? [])
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message })
    }
    return
  }

  // ── Project registry ───────────────────────────────────────────────────────
  if (p === '/api/projects' && req.method === 'GET') {
    sendJson(res, 200, { projects: readProjects().map(describeProject), home: os.homedir() })
    return
  }

  if (p === '/api/projects/add' && req.method === 'POST') {
    const body = await readBody(req)
    const target = typeof body.path === 'string' ? body.path : ''
    if (!target) {
      sendJson(res, 400, { error: 'A path is required.' })
      return
    }
    if (!existsSync(path.resolve(target))) {
      sendJson(res, 400, { error: 'Path not found on disk.' })
      return
    }
    if (!existsSync(path.join(path.resolve(target), 'dude.json'))) {
      sendJson(res, 400, { error: 'No dude.json here — is this a dude project?' })
      return
    }
    addProject(target)
    sendJson(res, 200, { projects: readProjects().map(describeProject) })
    return
  }

  if (p === '/api/projects/remove' && req.method === 'POST') {
    const body = await readBody(req)
    if (typeof body.path === 'string') removeProject(body.path)
    sendJson(res, 200, { projects: readProjects().map(describeProject) })
    return
  }

  if (p === '/api/projects/provision' && req.method === 'POST') {
    const body = await readBody(req)
    const target = typeof body.path === 'string' ? path.resolve(body.path) : ''
    if (!target || !isAllowedCwd(target)) {
      sendJson(res, 400, { error: 'Unknown project.' })
      return
    }
    const run = runs.start(target, 'pnpm', ['install'], ['pnpm', 'install'])
    sendJson(res, 200, { runId: run.id })
    return
  }

  // ── Command catalog (introspection-driven console) ─────────────────────────
  if (p === '/api/catalog') {
    const project = url.searchParams.get('project') ?? ''
    if (!project || !isAllowedCwd(project)) {
      sendJson(res, 400, { error: 'Unknown project.' })
      return
    }
    if (!declaredStack(project)) {
      sendJson(res, 200, { stackStatus: 'no-stack', commands: [], groups: [], projectCommands: [] })
      return
    }
    const { catalog, stackName } = await buildCatalog(project)
    const cat = JSON.parse(catalogToJson(catalog, stackName)) as CatalogJson
    const status: StackStatus = stackFailedToLoad(project, cat)
      ? hasWorkspaceAbove(project)
        ? 'needs-build'
        : 'needs-install'
      : 'ok'
    sendJson(res, 200, annotateCatalog(cat, status))
    return
  }

  // ── IaC environments (first-class env picker) ──────────────────────────────
  if (p === '/api/iac/envs') {
    const project = url.searchParams.get('project') ?? ''
    if (!project || !isAllowedCwd(project)) {
      sendJson(res, 400, { error: 'Unknown project.' })
      return
    }
    const envDir = path.join(project, 'iac', 'terraform', 'environments')
    let envs: string[] = []
    try {
      envs = readdirSync(envDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    } catch {
      envs = []
    }
    sendJson(res, 200, { envs })
    return
  }

  // ── Runs ────────────────────────────────────────────────────────────────────
  if (p === '/api/runs' && req.method === 'POST') {
    const body = await readBody(req)
    const cwd = typeof body.cwd === 'string' ? path.resolve(body.cwd) : ''
    const argv = body.argv
    if (!Array.isArray(argv) || argv.length === 0 || argv.some((a) => typeof a !== 'string')) {
      sendJson(res, 400, { error: 'argv must be a non-empty string array.' })
      return
    }
    if (!cwd || !isAllowedCwd(cwd)) {
      sendJson(res, 400, { error: 'Unknown project.' })
      return
    }
    // Server-side destructive gate for env-scoped teardown/apply: the request
    // must echo the env name (un-clickable-away, unlike a client confirm).
    const invoke = extractInvoke(argv as string[])
    if (needsEnvConfirm(invoke)) {
      const env = flagValue(argv as string[], 'env') ?? ''
      if (typeof body.confirm !== 'string' || body.confirm !== env) {
        sendJson(res, 409, { error: `Type the env name "${env}" to confirm.` })
        return
      }
    }
    const run = runs.start(cwd, process.execPath, [binPath, ...(argv as string[])], argv as string[])
    sendJson(res, 200, { runId: run.id })
    return
  }

  if (p === '/api/runs' && req.method === 'GET') {
    sendJson(res, 200, { runs: runs.list() })
    return
  }

  const streamMatch = p.match(/^\/api\/runs\/([^/]+)\/stream$/)
  if (streamMatch) {
    const run = runs.get(streamMatch[1]!)
    if (!run) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('no such run')
      return
    }
    const lastId = req.headers['last-event-id'] ?? url.searchParams.get('lastEventId')
    const afterSeq = lastId != null ? Number(lastId) : -1
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    let unsub = () => {}
    unsub = runs.subscribe(run, Number.isFinite(afterSeq) ? afterSeq : -1, (ev) => {
      if (ev.type === 'out') {
        res.write(`id: ${ev.seq}\nevent: out\ndata: ${JSON.stringify(ev.text)}\n\n`)
      } else {
        // Terminal frame → close the response so HTTP clients stop reading and
        // the connection doesn't leak. The browser's EventSource `done` handler
        // calls es.close(), so there's no reconnect loop.
        res.write(`event: done\ndata: ${JSON.stringify({ status: ev.status, code: ev.code })}\n\n`)
        unsub()
        res.end()
      }
    })
    req.on('close', unsub) // detach only — never kills the run
    return
  }

  const killMatch = p.match(/^\/api\/runs\/([^/]+)\/kill$/)
  if (killMatch && req.method === 'POST') {
    sendJson(res, 200, { ok: runs.kill(killMatch[1]!) })
    return
  }

  const delMatch = p.match(/^\/api\/runs\/([^/]+)$/)
  if (delMatch && req.method === 'DELETE') {
    sendJson(res, 200, { ok: runs.remove(delMatch[1]!) })
    return
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('not found')
}

// ── Command ──────────────────────────────────────────────────────────────────

export const serverCommand = defineCommand({
  meta: {
    name: 'server',
    description: 'Start a local web app to create and manage every dude project on this machine.',
  },
  args: {
    port: { type: 'string', description: 'Port to bind on 127.0.0.1. Default: a random free port.' },
    open: { type: 'boolean', description: 'Open the browser automatically.', default: true },
  },
  async run({ args }) {
    const binPath = process.argv[1]
    if (!binPath) {
      consola.error('Cannot resolve the dude entry point (process.argv[1]).')
      process.exit(1)
    }

    const server = createDudeServer(binPath)
    const port = args.port ? Number(args.port) : 0

    // Keep `run()` pending for the server's whole lifetime — otherwise citty's
    // runMain resolves and the process exits before the async bind completes.
    await new Promise<void>((resolve) => {
      server.on('error', (err) => {
        consola.error(`Could not start the server: ${(err as Error).message}`)
        resolve()
      })
      server.listen(port, '127.0.0.1', () => {
        const addr = server.address()
        const actual = typeof addr === 'object' && addr ? addr.port : port
        const url = `http://127.0.0.1:${actual}`
        consola.success(`dude server running at ${url}`)
        consola.info('Local only (127.0.0.1). Press Ctrl+C to stop.')
        if (args.open) openBrowser(url)
      })
      const shutdown = () => {
        server.runs.killAll()
        resolve()
      }
      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)
    })
    process.exit(0)
  },
})
