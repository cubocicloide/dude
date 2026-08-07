/**
 * Where a lint rule's prose lives, and how to read it.
 *
 * Two locations, both already established conventions — this module is only the
 * first thing to actually *read* them:
 *
 * 1. **Stack rules** → `{root}/.claude/rules/{GROUP}/{NNN}.md`, shipped by the
 *    stack template. The lint↔rule parity invariant
 *    (`.claude/rules/002-lint-template-parity.md`) guarantees the file exists for
 *    every stack check, and `make docs-check` fails CI on an orphan either way.
 * 2. **Project rules** → `{root}/.dude/lint/checks/{GROUP}/{NNN}.md`, a sibling of
 *    the check itself. Advertised to users in the contract every scaffold ships
 *    (`templates/base/.dude/lint/checks/README.md`: "You can document a rule with
 *    a Markdown file next to it"), and ignored by the engine because it is not a
 *    loadable module.
 *
 * Both `dude explain` and `dude cheatsheet` resolve through here so they cannot
 * disagree about where a rule is documented. The cheatsheet used to degrade every
 * project rule to a bare code precisely because it had nowhere to look.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'pathe'
import { PROJECT_CHECKS_DIR } from './index.js'
import type { DiscoveredCode } from './index.js'

/** Directory (relative to the project root) holding stack-rule prose. */
export const STACK_RULES_DIR = path.join('.claude', 'rules')

/** A rule's prose file: where it should be, and what is in it if anything is. */
export interface RuleDoc {
  code: string
  group: string
  source: 'stack' | 'project'
  /** Absolute path where the prose is expected — reported even when absent. */
  path: string
  /** Markdown body, or `undefined` when the file does not exist / is unreadable. */
  content?: string
}

/**
 * Absolute path where `code`'s prose belongs, by source.
 *
 * Kept separate from reading so callers can name the expected path in an error
 * message: "no prose at X" is actionable, "not documented" is not.
 */
export function ruleDocPath(root: string, discovered: Pick<DiscoveredCode, 'group' | 'id' | 'source'>): string {
  const { group, id, source } = discovered
  return source === 'stack'
    ? path.join(root, STACK_RULES_DIR, group, `${id}.md`)
    : path.join(root, PROJECT_CHECKS_DIR, group, `${id}.md`)
}

/** Read a rule's prose. A missing or unreadable file yields `content: undefined`. */
export function readRuleDoc(root: string, discovered: DiscoveredCode): RuleDoc {
  const file = ruleDocPath(root, discovered)
  const base: RuleDoc = {
    code: discovered.code,
    group: discovered.group,
    source: discovered.source,
    path: file,
  }
  if (!existsSync(file)) return base
  try {
    return { ...base, content: readFileSync(file, 'utf8') }
  } catch {
    return base
  }
}

/**
 * A rule's one-line title, taken from its prose heading.
 *
 * Every rule file opens with `# <CODE> — <title>`, so the heading is the
 * authoritative one-liner. Falls back to the bare code when the file is missing
 * or has no heading — a rule that runs must still be listed, and inventing a
 * description would be worse than showing none.
 */
export function ruleTitle(doc: RuleDoc): string {
  if (!doc.content) return doc.code
  const heading = doc.content.split('\n').find((l) => l.startsWith('# '))
  if (!heading) return doc.code
  // `# BE003 — Schema class conventions` → `Schema class conventions`
  return (
    heading
      .replace(/^#\s+/, '')
      .replace(new RegExp(`^${doc.code}\\s*[—-]\\s*`), '')
      .trim() || doc.code
  )
}
