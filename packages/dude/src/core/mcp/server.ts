/**
 * `dude mcp` — dude as an MCP server over stdio.
 *
 * Guiding principle, from the roadmap epic (#108): **dude is the tool an agent
 * uses, not an agent itself.** There is no model here, no API key, no network
 * call. The server exposes the commands this project already has and returns
 * what they already produce.
 *
 * ## Why every tool runs as a subprocess
 *
 * The stdio transport *is* this process's stdout — the MCP protocol frames
 * travel over it. Commands print. Running one in-process would interleave its
 * output with protocol frames and corrupt the session, and a command calling
 * `process.exit` on a validation error would take the server down with it.
 *
 * So each tool call spawns the same `dude` binary that is serving, and returns
 * its stdout/stderr/exit code. That also means the tools cannot drift from the
 * CLI: they *are* the CLI. `dude lint --format json` (added in #132) is what
 * makes this return structured diagnostics rather than scraped prose — it is the
 * reason this slice depends on that one.
 */
import { spawn } from 'node:child_process'
import path from 'pathe'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { getCliVersion, getPackageRoot } from '../../utils/paths.js'
import { deriveTools, isExposed, type CatalogJson, type DeriveOptions, type McpTool } from './tools.js'

export interface McpServerOptions extends DeriveOptions {
  /** Project root the tools run in. */
  projectRoot: string
}

/** Result of running one dude command. */
export interface CommandRun {
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * The `dude` entry point to spawn.
 *
 * `process.argv[1]` is the binary actually in use — under the launcher that is
 * the project's pinned `dude`, which is the one whose stack resolved this
 * catalog. Falling back to the package's own `bin/dude.mjs` covers being called
 * through an embedding that rewrote argv.
 */
export function dudeEntryPoint(): string {
  const argv1 = process.argv[1]
  if (argv1 && argv1.endsWith('.mjs')) return argv1
  return path.join(getPackageRoot(), 'bin', 'dude.mjs')
}

/** Turn a tool's JSON-Schema arguments back into CLI flags. */
export function argsToArgv(tool: McpTool, input: Record<string, unknown>): string[] {
  const argv: string[] = []
  for (const [key, value] of Object.entries(input ?? {})) {
    if (value === undefined || value === null) continue
    const declared = tool.inputSchema.properties[key]
    if (!declared) continue
    if (declared.type === 'boolean') {
      if (value === true) argv.push(`--${key}`)
      continue
    }
    argv.push(`--${key}`, String(value))
  }
  return argv
}

export function runDude(argv: string[], cwd: string): Promise<CommandRun> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [dudeEntryPoint(), ...argv], {
      cwd,
      // Never inherit: the parent's stdout is the MCP transport.
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1' },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (c) => (stdout += c))
    child.stderr.on('data', (c) => (stderr += c))
    child.on('error', (e) =>
      resolve({ stdout, stderr: `${stderr}${e instanceof Error ? e.message : String(e)}`, exitCode: 1 }),
    )
    child.on('close', (code) => resolve({ stdout, stderr, exitCode: code ?? 0 }))
  })
}

/** Read the resolved catalog by asking the CLI, so it is the same one `dude help` shows. */
async function readCatalog(projectRoot: string): Promise<CatalogJson> {
  const { stdout, stderr, exitCode } = await runDude(['help', '--format', 'json'], projectRoot)
  if (exitCode !== 0) {
    throw new Error(`Could not read the command catalog (dude help --format json):\n${stderr || stdout}`)
  }
  return JSON.parse(stdout)
}

/**
 * Format a run as MCP tool content.
 *
 * A non-zero exit is reported as `isError`, but the output is still returned:
 * `dude lint` exits 1 precisely when it has the diagnostics the agent asked for,
 * and swallowing them would make the tool useless in the one case that matters.
 */
function toContent(run: CommandRun, tool: McpTool) {
  const failed = run.exitCode !== 0
  if (tool.jsonArgs) {
    try {
      const parsed = JSON.parse(run.stdout)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(parsed, null, 2) }],
        structuredContent: parsed as Record<string, unknown>,
        // Structured output means the payload *is* the answer; a lint failure is
        // a successful tool call that found problems.
        isError: failed && run.stdout.trim() === '',
      }
    } catch {
      // Fall through: report the raw output rather than pretending it parsed.
    }
  }
  const text = [run.stdout, run.stderr].filter((s) => s.trim() !== '').join('\n').trim()
  return {
    content: [{ type: 'text' as const, text: text || `(no output, exit ${run.exitCode})` }],
    isError: failed,
  }
}

export async function startMcpServer(options: McpServerOptions): Promise<void> {
  const { projectRoot } = options
  const catalog = await readCatalog(projectRoot)
  const tools = deriveTools(catalog, options)
  const byName = new Map(tools.map((t) => [t.name, t]))

  const server = new Server(
    { name: 'dude', version: getCliVersion() },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = byName.get(request.params.name)
    if (!tool) {
      return {
        content: [{ type: 'text' as const, text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      }
    }
    // Deliberately redundant: `deriveTools` already withheld anything ungated, so
    // an ungated command has no tool to call and is rejected as unknown above.
    // This is the backstop for the next person who adds a tool to the list
    // without routing it through the gate — the failure that would otherwise
    // hand an agent `dude iac destroy` with no sign anything was wrong.
    if (tool.name !== 'dude_catalog' && !isExposed(tool.invocation, options)) {
      return {
        content: [
          {
            type: 'text' as const,
            text:
              `\`dude ${tool.invocation.join(' ')}\` is not exposed over MCP.\n` +
              `Add it to \`mcp.expose\` in dude.json, or start the server with --expose.`,
          },
        ],
        isError: true,
      }
    }
    const argv = [
      ...tool.invocation,
      ...argsToArgv(tool, (request.params.arguments ?? {}) as Record<string, unknown>),
      ...(tool.jsonArgs ?? []),
    ]
    return toContent(await runDude(argv, projectRoot), tool)
  })

  await server.connect(new StdioServerTransport())
}
