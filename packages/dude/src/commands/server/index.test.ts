import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer, request as httpRequest } from 'node:http'
import { writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'pathe'
import { createDudeServer, type DudeServer } from './index.js'
import { RunRegistry, type RunEvent } from './registry.js'
import { classify, needsEnvConfirm } from './classify.js'

// A stand-in "dude" binary the server re-execs: prints its argv, then exits 0.
const BIN = path.join(os.tmpdir(), `dude-test-bin-${process.pid}.mjs`)
writeFileSync(BIN, 'process.stdout.write("ARGV:" + process.argv.slice(2).join(",") + "\\n")\n')

// ── classify (GUI-side heuristics) ──────────────────────────────────────────
describe('classify', () => {
  it('flags destructive commands the old regex missed', () => {
    expect(classify(['iac', 'apply']).destructive).toBe(true)
    expect(classify(['iac', 'bootstrap']).destructive).toBe(true)
    expect(classify(['security', 'accept']).destructive).toBe(true)
    expect(classify(['down']).destructive).toBe(true)
    expect(classify(['db', 'rollback']).destructive).toBe(true)
    expect(classify(['lint']).destructive).toBe(false)
  })
  it('flags interactive (PTY) commands as out-of-scope', () => {
    expect(classify(['shell']).interactive).toBe(true)
    expect(classify(['iac', 'login']).interactive).toBe(true)
    expect(classify(['site', 'console']).interactive).toBe(true)
    expect(classify(['lint']).interactive).toBe(false)
  })
  it('flags follows-forever commands', () => {
    expect(classify(['logs']).follows).toBe(true)
    expect(classify(['docs']).follows).toBe(true)
    expect(classify(['dev']).follows).toBe(true)
    expect(classify(['lint']).follows).toBe(false)
  })
  it('needsEnvConfirm only for env-scoped destructive (iac)', () => {
    expect(needsEnvConfirm(['iac', 'destroy'])).toBe(true)
    expect(needsEnvConfirm(['iac', 'apply'])).toBe(true)
    expect(needsEnvConfirm(['down'])).toBe(false)
  })
})

// ── run registry (lifecycle decoupled from any request) ─────────────────────
describe('RunRegistry', () => {
  it('captures output + exit code and keeps the record for replay', async () => {
    const reg = new RunRegistry()
    const run = reg.start(os.tmpdir(), process.execPath, [BIN, 'hi'], ['echo', 'hi'])

    const events: RunEvent[] = []
    await new Promise<void>((resolve) => {
      reg.subscribe(run, -1, (ev) => {
        events.push(ev)
        if (ev.type === 'done') resolve()
      })
    })
    expect(events.some((e) => e.type === 'out' && e.text === 'ARGV:hi')).toBe(true)
    expect(events.at(-1)).toMatchObject({ type: 'done', code: 0 })

    // A late subscriber (reconnect) replays the buffered tail, then done.
    const replay: RunEvent[] = []
    reg.subscribe(run, -1, (ev) => replay.push(ev))
    expect(replay.some((e) => e.type === 'out' && e.text === 'ARGV:hi')).toBe(true)
    expect(replay.at(-1)).toMatchObject({ type: 'done' })

    // list() exposes a JSON-safe cross-project view.
    expect(reg.list()[0]).toMatchObject({ id: run.id, status: 'exited', exitCode: 0 })
  })
})

// ── server (security + endpoints) ───────────────────────────────────────────
describe('dude server', () => {
  let server: DudeServer
  let base: string
  let token: string

  beforeAll(async () => {
    server = createDudeServer(BIN)
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0
    base = `http://127.0.0.1:${port}`
    token = server.dudeToken
  })
  afterAll(() => {
    server.runs.killAll()
    server.close()
  })

  const tok = () => ({ 'x-dude-token': token })

  it('serves the page and injects the session token', async () => {
    const res = await fetch(base + '/')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('__DUDE__')
    expect(html).toContain(token)
  })

  it('rejects /api/* without the token', async () => {
    const res = await fetch(base + '/api/stacks')
    expect(res.status).toBe(403)
  })

  it('rejects a foreign Host header (DNS-rebind guard)', async () => {
    const status = await new Promise<number>((resolve) => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      const req = httpRequest(
        { host: '127.0.0.1', port, path: '/api/stacks', headers: { Host: 'evil.example.com', 'x-dude-token': token } },
        (res) => resolve(res.statusCode ?? 0),
      )
      req.end()
    })
    expect(status).toBe(403)
  })

  it('lists stacks with a valid token', async () => {
    const res = await fetch(base + '/api/stacks', { headers: tok() })
    expect(res.status).toBe(200)
    const data = (await res.json()) as { stacks: string[] }
    expect(Array.isArray(data.stacks)).toBe(true)
  })

  it('refuses to run in an unregistered cwd', async () => {
    const res = await fetch(base + '/api/runs', {
      method: 'POST',
      headers: { ...tok(), 'content-type': 'application/json' },
      body: JSON.stringify({ cwd: '/definitely/not/registered', argv: ['lint'] }),
    })
    expect(res.status).toBe(400)
  })

  it('rejects a malformed argv', async () => {
    const res = await fetch(base + '/api/runs', {
      method: 'POST',
      headers: { ...tok(), 'content-type': 'application/json' },
      body: JSON.stringify({ cwd: os.homedir(), argv: [] }),
    })
    expect(res.status).toBe(400)
  })

  it('runs a command in the home dir and streams it to completion', async () => {
    const start = await fetch(base + '/api/runs', {
      method: 'POST',
      headers: { ...tok(), 'content-type': 'application/json' },
      body: JSON.stringify({ cwd: os.homedir(), argv: ['hello', 'world'] }),
    })
    expect(start.status).toBe(200)
    const { runId } = (await start.json()) as { runId: string }
    expect(runId).toBeTruthy()

    // Drain the SSE stream (token via query param — EventSource can't set headers).
    const text = await new Promise<string>((resolve) => {
      const addr = server.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      let buf = ''
      const req = httpRequest(
        { host: '127.0.0.1', port, path: `/api/runs/${runId}/stream?token=${token}` },
        (res) => {
          res.setEncoding('utf8')
          res.on('data', (c) => {
            buf += c
            if (buf.includes('event: done')) {
              req.destroy()
              resolve(buf)
            }
          })
        },
      )
      req.end()
    })
    expect(text).toContain('ARGV:hello,world')
    expect(text).toContain('event: done')
  })

  it('404s a stream for an unknown run', async () => {
    const res = await fetch(base + '/api/runs/nope/stream?token=' + token)
    expect(res.status).toBe(404)
  })
})
