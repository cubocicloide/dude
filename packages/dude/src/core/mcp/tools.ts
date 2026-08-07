/**
 * Deriving the MCP tool list from dude's own command catalog.
 *
 * There is no per-command wiring here and there must never be: the tool list is
 * a projection of `dude help --format json`, which already resolves core + the
 * active stack + project-local `.dude/commands/` for the project you are
 * standing in. A stack that adds a command, or a project that drops one in
 * `.dude/commands/`, gets an MCP tool for free — the same introspection idea as
 * the declined GUI (`docs/adr/0001-gui.md`), except the "UI" is the agent, so
 * there is nothing to maintain.
 *
 * This module is deliberately pure — catalog in, tool descriptors out — so the
 * gate below can be tested without starting a server or spawning anything.
 */

/** One command as it appears in `dude help --format json`. */
export interface CatalogArg {
  name: string
  type: string
  description: string
  required?: boolean
  default?: unknown
}

export interface CatalogCommand {
  name: string
  description: string
  args: CatalogArg[]
}

export interface CatalogJson {
  dudeVersion?: string
  stack?: string | null
  commands: CatalogCommand[]
  groups: Array<{ name: string; subcommands: CatalogCommand[] }>
  projectCommands?: CatalogCommand[]
}

/** How a default-exposed command is presented as a tool. */
interface ReadOnlySpec {
  /** Appended to the invocation; stdout is then parsed as JSON. */
  jsonArgs?: string[]
  /**
   * Arguments withheld from the tool schema.
   *
   * Two reasons, both real: an argument that makes the command **write**
   * (`cheatsheet --out <file>`) would smuggle a side effect into a read-only
   * tool, and an argument that changes the output shape (`--format`) would let
   * the agent break the structured contract this tool promises.
   */
  omitArgs?: string[]
}

/**
 * Commands exposed without any opt-in, and how.
 *
 * Read-only in the sense that matters here: they inspect the project and print,
 * they do not start containers, write files, touch a cloud account or publish
 * anything. Everything else is denied by default — an agent that can run
 * `dude iac destroy` because it appeared in a catalog is a far worse outcome
 * than an agent that has to be handed the tool explicitly.
 *
 * Group subcommands are keyed `"<group> <sub>"`.
 */
const READ_ONLY: Record<string, ReadOnlySpec> = {
  // `--format` is withheld on both: the tool guarantees JSON, and letting the
  // agent ask for prose would silently break `structuredContent`.
  lint: { jsonArgs: ['--format', 'json'], omitArgs: ['format'] },
  cheatsheet: { jsonArgs: ['--format', 'json'], omitArgs: ['format', 'out'] },
  explain: {},
  info: {},
  version: {},
  'api review': {},
}

export const DEFAULT_EXPOSED: readonly string[] = Object.keys(READ_ONLY)

/** MCP tool names allow `[a-z0-9_-]`; `dude api review` → `dude_api_review`. */
export function toolName(invocation: readonly string[]): string {
  return ['dude', ...invocation].join('_').replace(/[^a-zA-Z0-9_-]/g, '_')
}

export interface McpTool {
  /** MCP-facing tool name. */
  name: string
  /** argv handed to the dude binary, e.g. `['api', 'review']`. */
  invocation: string[]
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, { type: string; description?: string }>
    required?: string[]
  }
  /**
   * When set, the tool appends these arguments and parses stdout as JSON, so the
   * agent receives structured data rather than prose it would have to scrape.
   * This is what `dude lint --format json` exists for.
   */
  jsonArgs?: string[]
}

export interface DeriveOptions {
  /**
   * Extra commands to expose, beyond `DEFAULT_EXPOSED` — from `dude.json`
   * (`mcp.expose`) or `--expose`. Same `"<group> <sub>"` spelling.
   */
  expose?: readonly string[]
  /**
   * Expose every command in the catalog, including destructive ones. Off unless
   * the operator asks for it, and reported when it is on.
   */
  allowMutating?: boolean
}

/** JSON Schema for a command's arguments, from the catalog's own arg metadata. */
function inputSchema(cmd: CatalogCommand, omit: readonly string[] = []): McpTool['inputSchema'] {
  const properties: Record<string, { type: string; description?: string }> = {}
  const required: string[] = []
  for (const a of cmd.args) {
    if (omit.includes(a.name)) continue
    properties[a.name] = {
      type: a.type === 'boolean' ? 'boolean' : 'string',
      ...(a.description ? { description: a.description } : {}),
    }
    if (a.required) required.push(a.name)
  }
  return { type: 'object', properties, ...(required.length ? { required } : {}) }
}

/**
 * The synthetic `catalog` tool.
 *
 * Not a dude command — it is how an agent discovers what this particular project
 * exposes, including the commands the gate is withholding. Backed by
 * `dude help --format json`.
 */
function catalogTool(): McpTool {
  return {
    name: 'dude_catalog',
    invocation: ['help'],
    jsonArgs: ['--format', 'json'],
    description:
      "The full resolved command catalog for this project (core + active stack + project-local .dude/commands/). Use it to discover what this project can do; commands not exposed as tools still appear here.",
    inputSchema: { type: 'object', properties: {} },
  }
}

/**
 * Project the catalog onto the MCP tool list, applying the exposure gate.
 *
 * The gate is applied *here*, not at call time only, so a withheld command is
 * never advertised in the first place — but `isExposed` is exported so the
 * server can re-check on invocation. Both matter: the list is advice, the
 * call-time check is the actual boundary.
 */
export function deriveTools(catalog: CatalogJson, options: DeriveOptions = {}): McpTool[] {
  const exposed = exposureSet(options)
  const tools: McpTool[] = [catalogTool()]

  const consider = (cmd: CatalogCommand, invocation: string[]) => {
    const key = invocation.join(' ')
    if (!options.allowMutating && !exposed.has(key)) return
    // `catalog` already covers `help`, and a second tool for it is noise.
    if (key === 'help') return
    // A command opted in via `expose`/`--allow-mutating` has no read-only spec;
    // it is passed through with its full argument set, which is the point of
    // opting in.
    const spec = READ_ONLY[key] ?? {}
    tools.push({
      name: toolName(invocation),
      invocation,
      description: cmd.description,
      inputSchema: inputSchema(cmd, spec.omitArgs),
      ...(spec.jsonArgs ? { jsonArgs: spec.jsonArgs } : {}),
    })
  }

  for (const cmd of catalog.commands) consider(cmd, [cmd.name])
  for (const group of catalog.groups) {
    for (const sub of group.subcommands) consider(sub, [group.name, sub.name])
  }
  // Project-local commands are the project author's own code. They are never
  // exposed by default — dude cannot know what they do.
  for (const cmd of catalog.projectCommands ?? []) consider(cmd, [cmd.name])

  return tools
}

/** The effective allowlist: defaults plus whatever was explicitly opted in. */
export function exposureSet(options: DeriveOptions = {}): Set<string> {
  return new Set([...DEFAULT_EXPOSED, ...(options.expose ?? [])])
}

/**
 * Whether an invocation may run. Called again at invocation time — the tool list
 * is what a client was told, not what it is limited to sending.
 */
export function isExposed(invocation: readonly string[], options: DeriveOptions = {}): boolean {
  if (options.allowMutating) return true
  return exposureSet(options).has(invocation.join(' '))
}
