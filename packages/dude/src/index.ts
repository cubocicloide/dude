/**
 * Public API of @cubocicloide/dude.
 *
 * Stack plugins import `defineStack` from this module; project configuration
 * files import `defineConfig`.
 */

export { defineStack, defineCommand } from './core/stack-contract.js'
export type {
  StackDefinition,
  StackContext,
  StackVariable,
  StackRule,
  StackHookContext,
  StackCommandDef,
  StackCommandArg,
  StackCommandContext,
} from './core/stack-contract.js'

export { defineConfig } from './core/config.js'
export type { DudeConfig } from './core/config.js'

// Lint types — imported by stack check files
export type { RawDiagnostic, CheckFn, Severity } from './core/lint/types.js'

// Lint engine — used by stacks that expose a `lint` command
export { runLint, type LintResult } from './core/lint/index.js'
export { formatDiagnostic, type Diagnostic } from './core/lint/types.js'

// Template rendering — used by stacks that define a custom scaffold
export { renderTemplateTree } from './core/template-runner.js'
export type { RenderOptions } from './core/template-runner.js'
