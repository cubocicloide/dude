/**
 * Public API of @cubocicloide/dude.
 *
 * Stack plugins import `defineStack` from this module; project configuration
 * files import `defineConfig`.
 */

export { defineStack, defineCommand, stackDocsSchema } from './core/stack-contract.js'
export type {
  StackDefinition,
  StackContext,
  StackVariable,
  StackRule,
  StackHookContext,
  StackCommandDef,
  StackCommandArg,
  StackCommandContext,
  StackDocs,
} from './core/stack-contract.js'

export { defineConfig } from './core/config.js'
export type { DudeConfig } from './core/config.js'

// Lint types — imported by stack check files
export type { RawDiagnostic, CheckFn, Severity } from './core/lint/types.js'

// Lint engine — used by stacks that expose a `lint` command
export { runLint, PROJECT_CHECKS_DIR, type LintResult } from './core/lint/index.js'
export { formatDiagnostic, type Diagnostic } from './core/lint/types.js'

// Shared `lint` command — stacks register it instead of hand-rolling a wrapper
export { defineLintCommand, type LintCommandOptions } from './core/lint/command.js'

// Template rendering — used by stacks that define a custom scaffold
export { renderTemplateTree } from './core/template-runner.js'
export type { RenderOptions } from './core/template-runner.js'

// Command catalog → docs. Used by stacks (e.g. a `docs` command) to generate a
// live API reference that reflects the project's init choices + custom commands.
import { buildCatalog, catalogToMarkdown, catalogToJson } from './commands/help/index.js'

/**
 * Render the project's full, init-aware command catalog (the same one `dude help`
 * shows) as Markdown (default) or JSON. Stacks call this to regenerate a
 * `docs/api.md` page on the fly, so the docs always match the real commands.
 */
export async function generateApiDoc(cwd: string, format: 'md' | 'json' = 'md'): Promise<string> {
  const { catalog, stackName } = await buildCatalog(cwd)
  return format === 'json' ? catalogToJson(catalog, stackName) : catalogToMarkdown(catalog, stackName)
}
