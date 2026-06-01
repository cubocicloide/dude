/**
 * Public API of @cubocicloide/dude.
 *
 * Stack plugins import `defineStack` from this module; project configuration
 * files import `defineConfig`.
 */

export { defineStack } from './core/stack-contract.js'
export type {
  StackDefinition,
  StackContext,
  StackVariable,
  StackRule,
  StackHookContext,
} from './core/stack-contract.js'

export { defineConfig } from './core/config.js'
export type { DudeConfig } from './core/config.js'

// Lint types — imported by stack check files
export type { RawDiagnostic, CheckFn, Severity } from './core/lint/types.js'
