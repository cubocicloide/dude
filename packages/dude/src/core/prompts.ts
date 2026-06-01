import * as prompts from '@clack/prompts'
import type { StackVariable } from './stack-contract.js'

/**
 * Prompt the user for the variables declared by a stack, applying the
 * answers passed via CLI flags as overrides.
 */
export interface PromptOptions {
  overrides?: Record<string, unknown>
  /** When true, accept defaults non-interactively (fails for vars without one). */
  yes?: boolean
}

export async function promptVariables(
  variables: StackVariable[],
  options: PromptOptions = {},
): Promise<Record<string, unknown>> {
  const overrides = options.overrides ?? {}
  const answers: Record<string, unknown> = { ...overrides }

  for (const v of variables) {
    if (answers[v.name] !== undefined) continue

    if (options.yes) {
      if (v.default === undefined) {
        throw new Error(`Variable "${v.name}" has no default; cannot run with --yes.`)
      }
      answers[v.name] = v.default
      continue
    }

    const message = v.prompt ?? v.name
    let value: unknown

    if (v.type === 'string') {
      value = await prompts.text({
        message,
        initialValue: v.default,
        validate: (input) => {
          if (!input) return 'Required'
          if (v.pattern && !new RegExp(v.pattern).test(input)) {
            return `Must match ${v.pattern}`
          }
          return undefined
        },
      })
    } else if (v.type === 'boolean') {
      value = await prompts.confirm({ message, initialValue: v.default ?? true })
    } else if (v.type === 'select') {
      value = await prompts.select({
        message,
        options: v.choices.map((c) => ({ value: c, label: c })),
        initialValue: v.default,
      })
    }

    if (prompts.isCancel(value)) {
      prompts.cancel('Aborted.')
      process.exit(0)
    }

    answers[v.name] = value
  }

  return answers
}
