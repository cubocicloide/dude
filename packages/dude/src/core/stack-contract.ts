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
  /** Absolute path of the stack plugin root (where `template/` lives). */
  readonly stackRoot: string
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
   * `template/` folder shipped with the plugin, applying Handlebars
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
