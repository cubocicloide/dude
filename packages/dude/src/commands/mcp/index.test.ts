/**
 * Integration test: `dude mcp`
 *
 * Speaks the real protocol over stdio against a real scaffolded project — a
 * unit test of the tool derivation (see `core/mcp/tools.test.ts`) cannot show
 * that the transport works, that stdout stays clean enough to parse, or that
 * `dude lint --format json` actually arrives as structured content.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { Project, DUDE_BIN } from '../../utils/testing.js'

let project: Project

/** A minimal MCP client: enough of the handshake to list and call tools. */
class McpProbe {
  private child: ChildProcessWithoutNullStreams
  private buffer = ''
  private pending = new Map<number, (msg: Record<string, any>) => void>()
  private nextId = 0
  stderr = ''

  constructor(cwd: string, args: string[] = []) {
    this.child = spawn(process.execPath, [DUDE_BIN, 'mcp', ...args], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    }) as ChildProcessWithoutNullStreams
    this.child.stdout.on('data', (c: Buffer) => {
      this.buffer += c.toString()
      let i: number
      while ((i = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, i).trim()
        this.buffer = this.buffer.slice(i + 1)
        if (!line) continue
        const msg = JSON.parse(line)
        const resolve = this.pending.get(msg.id)
        if (resolve) {
          this.pending.delete(msg.id)
          resolve(msg)
        }
      }
    })
    this.child.stderr.on('data', (c: Buffer) => (this.stderr += c.toString()))
  }

  private send(method: string, params: unknown): Promise<Record<string, any>> {
    const id = ++this.nextId
    return new Promise((resolve) => {
      this.pending.set(id, resolve)
      this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    })
  }

  async initialize() {
    const res = await this.send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'vitest-probe', version: '0' },
    })
    this.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
    return res
  }

  async listTools(): Promise<string[]> {
    const res = await this.send('tools/list', {})
    return res.result.tools.map((t: { name: string }) => t.name)
  }

  callTool(name: string, args: Record<string, unknown> = {}) {
    return this.send('tools/call', { name, arguments: args })
  }

  stop() {
    this.child.kill()
  }
}

describe('dude mcp', () => {
  beforeAll(() => {
    project = Project.scaffold({ prefix: 'dude-mcp-' })
  }, 120_000)

  afterAll(() => project.cleanup())

  it('completes the MCP handshake and identifies itself as dude', async () => {
    const probe = new McpProbe(project.dir)
    try {
      const res = await probe.initialize()
      expect(res.result.serverInfo.name).toBe('dude')
    } finally {
      probe.stop()
    }
  }, 60_000)

  it('derives a read-only tool list from the project catalog', async () => {
    const probe = new McpProbe(project.dir)
    try {
      await probe.initialize()
      const tools = await probe.listTools()

      expect(tools).toContain('dude_catalog')
      expect(tools).toContain('dude_lint')
      expect(tools).toContain('dude_explain')

      // The gate: nothing that starts containers, writes, deploys or destroys.
      for (const withheld of ['dude_up', 'dude_down', 'dude_test', 'dude_iac_destroy']) {
        expect(tools).not.toContain(withheld)
      }
    } finally {
      probe.stop()
    }
  }, 60_000)

  it('returns lint diagnostics as structured content, not scraped prose', async () => {
    const probe = new McpProbe(project.dir)
    try {
      await probe.initialize()
      const res = await probe.callTool('dude_lint')
      // The #132 payload, arriving intact through the transport.
      expect(res.result.structuredContent).toMatchObject({
        schema: 'dude.lint/v1',
        errorCount: expect.any(Number),
        diagnostics: expect.any(Array),
      })
    } finally {
      probe.stop()
    }
  }, 60_000)

  it('serves rule prose through the explain tool', async () => {
    const probe = new McpProbe(project.dir)
    try {
      await probe.initialize()
      const res = await probe.callTool('dude_explain', { code: 'BE003' })
      expect(res.result.content[0].text).toContain('BE003')
      expect(res.result.isError).toBeFalsy()
    } finally {
      probe.stop()
    }
  }, 60_000)

  it('refuses a command that was never exposed', async () => {
    const probe = new McpProbe(project.dir)
    try {
      await probe.initialize()
      const res = await probe.callTool('dude_down')
      expect(res.result.isError).toBe(true)
    } finally {
      probe.stop()
    }
  }, 60_000)

  it('exposes an opted-in command via --expose, and nothing more', async () => {
    const probe = new McpProbe(project.dir, ['--expose', 'test'])
    try {
      await probe.initialize()
      const tools = await probe.listTools()
      expect(tools).toContain('dude_test')
      expect(tools).not.toContain('dude_down')
    } finally {
      probe.stop()
    }
  }, 60_000)

  it('keeps stdout clean — the operator banner goes to stderr', async () => {
    const probe = new McpProbe(project.dir)
    try {
      await probe.initialize()
      await probe.listTools()
      // Every stdout line parsed as JSON above; the banner must not be there.
      expect(probe.stderr).toContain('dude mcp:')
    } finally {
      probe.stop()
    }
  }, 60_000)
})
