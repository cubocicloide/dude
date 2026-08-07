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
export {
  runLint,
  PROJECT_CHECKS_DIR,
  readDisabledCodes,
  discoverCheckCodes,
  type LintResult,
  type DiscoveredCode,
} from './core/lint/index.js'
export { formatDiagnostic, type Diagnostic } from './core/lint/types.js'

// Shared `lint` command — stacks register it instead of hand-rolling a wrapper
export {
  defineLintCommand,
  LINT_JSON_SCHEMA,
  type LintCommandOptions,
  type LintJsonReport,
} from './core/lint/command.js'

// Shared `explain` command — serves the prose behind a lint code. Pairs with
// `dude lint --format json`: lint says what broke, explain says how to fix it.
export { defineExplainCommand, type ExplainCommandOptions } from './core/lint/explain-command.js'

// Rule prose resolution — one lookup shared by `explain` and `cheatsheet`, so
// they cannot disagree about where a rule is documented.
export {
  readRuleDoc,
  ruleDocPath,
  ruleTitle,
  STACK_RULES_DIR,
  type RuleDoc,
} from './core/lint/rules.js'

// Shared `docs` command — serves the project site and refreshes its generated
// pages. Stacks register it instead of carrying a copy each.
export { defineDocsCommand, type DocsCommandOptions } from './core/docs/command.js'

// Cheatsheet — the project's answer-aware quick reference. Stacks register the
// shared command; the renderer is here so there is exactly one implementation.
export {
  defineCheatsheetCommand,
  type CheatsheetCommandOptions,
} from './core/cheatsheet/command.js'
export {
  generateCheatsheet,
  collectCheatsheetData,
  type CheatsheetData,
  type CheatsheetRule,
} from './core/cheatsheet/index.js'

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
