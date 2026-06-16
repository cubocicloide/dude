import { z } from 'zod'

/**
 * Stack plugin contract.
 *
 * The bootstrap shape is deliberately small: a stack must declare its
 * identity, the variables it needs from the user, and a `scaffold` step.
 * Optional lifecycle hooks (`preInit`, `postInit`) round out the minimum
 * viable plugin. Lint, rules, generators and extra commands will be added
 * as the matching CLI commands are implemented.
 */

// ---------- Variables ----------

const stringVariable = z.object({
  name: z.string().min(1),
  type: z.literal('string'),
  prompt: z.string().optional(),
  default: z.string().optional(),
  /** Regex pattern as a string (so the schema stays serializable). */
  pattern: z.string().optional(),
})

const booleanVariable = z.object({
  name: z.string().min(1),
  type: z.literal('boolean'),
  prompt: z.string().optional(),
  default: z.boolean().optional(),
})

const selectVariable = z.object({
  name: z.string().min(1),
  type: z.literal('select'),
  prompt: z.string().optional(),
  choices: z.array(z.string().min(1)).min(1),
  default: z.string().optional(),
})

export const stackVariableSchema = z.discriminatedUnion('type', [
  stringVariable,
  booleanVariable,
  selectVariable,
])

export type StackVariable = z.infer<typeof stackVariableSchema>

// ---------- Runtime context ----------

/**
 * Context object passed to lifecycle hooks and to `scaffold`.
 * Implemented by the CLI at runtime; the type only describes what plugins
 * may rely on.
 */
export interface StackContext {
  /** Resolved answers for the variables declared by the stack. */
  readonly answers: Record<string, unknown>
  /** Absolute path of the target project directory. */
  readonly dest: string
  /** Absolute path of the stack plugin root (where `templates/` lives). */
  readonly stackRoot: string
  /** Version of the dude CLI that is running the init. */
  readonly dudeVersion: string
  /** Resolved version of the stack plugin being scaffolded. */
  readonly stackVersion: string
  /** Tagged logger. */
  readonly logger: {
    info: (msg: string) => void
    warn: (msg: string) => void
    success: (msg: string) => void
    error: (msg: string) => void
  }
}

export type StackHookContext = StackContext

// ---------- Rules (placeholder for upcoming phases) ----------

export interface StackRule {
  id: string
  message: string
  check: (ctx: StackContext) => boolean | Promise<boolean>
}

// ---------- Stack commands ----------

export interface StackCommandArg {
  type: 'string' | 'boolean'
  description?: string
  default?: string | boolean
  required?: boolean
}

export interface StackCommandContext {
  /** Absolute path of the user's project (cwd at invocation). */
  projectRoot: string
  /** Absolute path of the stack package installation root. */
  stackRoot: string
  /** Parsed CLI flags. */
  args: Record<string, unknown>
}

export interface StackCommandDef {
  description: string
  args?: Record<string, StackCommandArg>
  run: (ctx: StackCommandContext) => Promise<void>
  /**
   * Optional visibility predicate. When present and it returns `false` for the
   * current project, the command is hidden from `dude help` (and should also be
   * guarded at runtime by its own `run`). Used for features that only exist
   * when a matching init answer was chosen — e.g. the `iac` group only shows up
   * when the project was scaffolded with an IaC target, the `db` group only when
   * PostgreSQL was selected. Receives the project root (where `dude.json` lives).
   */
  available?: (projectRoot: string) => boolean
}

/**
 * Identity helper for project-local custom commands defined under
 * `.dude/commands/`:
 *
 *   // .dude/commands/reset.ts
 *   import { defineCommand } from '@cubocicloide/dude'
 *   export default defineCommand({
 *     description: 'Reset the database to a clean state.',
 *     async run({ projectRoot, args }) { ... },
 *   })
 *
 * It returns the definition unchanged; its only job is to attach the
 * `StackCommandDef` type so editors give autocomplete and type-checking.
 */
export function defineCommand(definition: StackCommandDef): StackCommandDef {
  return definition
}

// ---------- Stack definition ----------

export interface StackDefinition {
  /** Short, kebab-case name (e.g. `react-fastapi`). */
  name: string
  /** Plugin version — should mirror the npm `package.json` version. */
  version: string
  /** Minimum dude CLI version this plugin is compatible with. */
  minDudeVersion: string
  /** Human-readable description shown by `dude stack info`. */
  description: string
  /** Variables prompted during `dude init`. */
  variables?: StackVariable[]
  /**
   * Optional explicit scaffold step. If omitted, the CLI copies the
   * `templates/base` folder shipped with the plugin, applying Handlebars
   * substitution on `.hbs` files using `ctx.answers` as the data.
   */
  scaffold?: (ctx: StackContext) => Promise<void>
  /** Lifecycle hooks. */
  hooks?: {
    preInit?: (ctx: StackHookContext) => Promise<void>
    postInit?: (ctx: StackHookContext) => Promise<void>
  }
  /** Custom rules; will be wired in by `dude rules check` later. */
  rules?: StackRule[]
  /**
   * Stack-provided commands. Two shapes are supported:
   *
   *   commands.lint         = StackCommandDef                  → `dude lint`
   *   commands.api          = { sync, review: StackCommandDef } → `dude api sync`
   *
   * A flat entry overrides a core CLI command with the same name.
   * A grouped entry adds a new `dude <group> <sub>` namespace.
   */
  commands?: Record<string, StackCommandDef | Record<string, StackCommandDef>>
}

/**
 * Identity helper used by stack packages:
 *
 *   import { defineStack } from '@cubocicloide/dude'
 *   export default defineStack({ ... })
 */
export function defineStack(definition: StackDefinition): StackDefinition {
  return definition
}
