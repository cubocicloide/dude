/**
 * Argv → `args` for stack and project commands.
 *
 * Extracted from the dispatcher so it can be tested directly: the binding rules
 * below are subtle enough that "it worked when I tried it" is not evidence.
 */
import type { StackCommandArg } from './stack-contract.js'

/**
 * Parse a command's raw argv into the `args` object its `run` receives.
 *
 * - `--flag=value` and `--flag value` bind a value; a bare `--flag` binds `true`.
 * - A flag the command **declares as boolean** never consumes the following
 *   word. Without that, `dude explain --quiet BE003` would bind `quiet="BE003"`
 *   and lose the positional — harmless while positionals were dropped anyway, a
 *   real footgun now that they carry meaning. An *undeclared* flag still
 *   consumes the next word, since nothing says otherwise.
 * - Bare words are collected in order and bound to the args declared as
 *   `type: 'positional'`. They were previously parsed and discarded, so a
 *   positional could never reach a command.
 * - The full positional list is always exposed as `_`.
 */
export function parseRawArgs(
  argv: string[],
  argSpec?: Record<string, StackCommandArg>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const positionals: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=')
      if (eqIdx !== -1) {
        result[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1)
        continue
      }
      const name = arg.slice(2)
      const next = argv[i + 1]
      const isBooleanFlag = argSpec?.[name]?.type === 'boolean'
      if (!isBooleanFlag && next !== undefined && !next.startsWith('-')) {
        result[name] = next
        i++
      } else {
        result[name] = true
      }
    } else if (!arg.startsWith('-')) {
      positionals.push(arg)
    }
  }

  Object.entries(argSpec ?? {})
    .filter(([, a]) => a.type === 'positional')
    .forEach(([name], idx) => {
      const value = positionals[idx]
      if (value !== undefined) result[name] = value
    })

  result._ = positionals
  return result
}
