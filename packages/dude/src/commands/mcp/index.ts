/**
 * `dude mcp` — serve this project's commands to an MCP client over stdio.
 *
 * Core rather than per-stack: the tool list is derived from the resolved
 * catalog, which already includes whatever stack and project-local commands
 * exist here, so there is nothing for a stack to register. It also means
 * `dude mcp` works in a project whose stack is minimal.
 *
 * Nothing may be written to stdout from here — it is the transport. Anything
 * the operator needs to see goes to stderr, which MCP clients surface as server
 * logs.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import { defineCommand } from 'citty'
import { startMcpServer } from '../../core/mcp/server.js'
import { DEFAULT_EXPOSED } from '../../core/mcp/tools.js'

/** `mcp` settings from dude.json, with the missing bits defaulted away. */
export function readMcpConfig(root: string): { expose: string[]; allowMutating: boolean } {
  const file = path.join(root, 'dude.json')
  if (!existsSync(file)) return { expose: [], allowMutating: false }
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as {
      mcp?: { expose?: unknown; allowMutating?: unknown }
    }
    const expose = Array.isArray(parsed.mcp?.expose)
      ? parsed.mcp.expose.filter((e): e is string => typeof e === 'string')
      : []
    return { expose, allowMutating: parsed.mcp?.allowMutating === true }
  } catch {
    // A malformed dude.json is reported by every other command; here the safe
    // reading is the restrictive one rather than refusing to start.
    return { expose: [], allowMutating: false }
  }
}

export const mcpCommand = defineCommand({
  meta: {
    name: 'mcp',
    description:
      'Serve this project as an MCP server over stdio, so a coding agent can run its ' +
      'read-only commands (lint, explain, catalog, …) as tools. Read-only by default.',
  },
  args: {
    expose: {
      type: 'string',
      description:
        'Comma-separated commands to expose beyond the read-only defaults, e.g. ' +
        '"test,api sync". Merged with `mcp.expose` in dude.json.',
    },
    'allow-mutating': {
      type: 'boolean',
      description:
        'Expose EVERY command in the catalog, including destructive ones (dude iac destroy, ' +
        'dude down, …). Off by default. Only use with a client you trust.',
      default: false,
    },
  },
  async run({ args }) {
    const projectRoot = process.cwd()
    const config = readMcpConfig(projectRoot)

    const fromFlag = String(args.expose ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const expose = [...config.expose, ...fromFlag]
    const allowMutating = Boolean(args['allow-mutating']) || config.allowMutating

    // stderr only — stdout belongs to the protocol.
    process.stderr.write(
      `dude mcp: serving ${projectRoot}\n` +
        (allowMutating
          ? 'dude mcp: --allow-mutating is ON — every command in the catalog is exposed.\n'
          : `dude mcp: read-only (${DEFAULT_EXPOSED.join(', ')})` +
            (expose.length ? ` plus ${expose.join(', ')}` : '') +
            '\n'),
    )

    await startMcpServer({ projectRoot, expose, allowMutating })
  },
})
