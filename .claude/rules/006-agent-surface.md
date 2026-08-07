# The agent-facing surface every stack ships

## Why there is a declared minimum

A scaffolded project's `.claude/` directory and `.vscode/tasks.json` are how a
coding agent learns the stack's conventions without being told them. They are
also the easiest thing to forget when adding a stack: nothing breaks, no test
fails, the scaffold still works — it is simply worse, and only for the people
who never file a bug about it.

That is exactly how the surface ended up built out on two stacks out of six
(#108, #134). A minimum written down is the cheapest guard against the same
drift happening to stack number seven.

## The minimum

Every stack's `templates/base/` ships **all** of:

| Path | What |
| ---- | ---- |
| `.vscode/tasks.json` | The lint-watch task. **Byte-identical across stacks** — copy it, do not write a variant. |
| `.claude/rules/<GROUP>/<NNN>.md` | One per lint check. Already enforced mechanically by `make docs-check` — see `002-lint-template-parity.md`. |
| `.claude/agents/issue-fixer.md` | Adapted to the stack's real verify loop and layout. |
| `.claude/skills/clean-branches/SKILL.md` | Stack-agnostic. Copy verbatim. |
| `.claude/skills/fix-issues/SKILL.md` | Stack-agnostic. Copy verbatim. |
| `.claude/skills/create-<artifact>/SKILL.md` | **At least one per primary artifact the stack scaffolds** — the recurring "add a thing" workflows. |
| `.claude/skills/create/SKILL.md` | The router skill. Required once a stack has more than one `create-*`. |
| `.dude/lint/checks/PRJ/001.{ts,md}` | The worked example of a project-defined rule, check **and** prose. |
| `.dude/commands/` | The hello-world custom command plus its contract README. |

Conditional, and only where the stack genuinely registers the command:

| Path | Ships when |
| ---- | ---------- |
| `.claude/agents/security-fixer.md`, `.claude/skills/security-scan/`, `.claude/skills/verify-security-fixes/` | the stack registers a `security` command group |

A stack that deliberately omits something from the minimum must say so, and why,
in its own `templates/base/CLAUDE.md.hbs`. Silence is treated as an oversight.

## The rule that makes skills worth having

**A skill must only reference commands the stack actually registers.** This is
the failure mode that makes an agent surface worse than none: an agent told to
run `dude security scan` on a stack without a `security` group wastes a turn and
then improvises. Check `definition.commands` in `stacks/<id>/src/index.ts` before
writing a command into a skill — not another stack's skill, which is where the
wrong command would be copied from.

The same applies to paths and lint codes: everything a skill names must exist in
that stack's own template tree and rule set.

`make agent-surface-check` enforces this mechanically (`scripts/check-agent-surface.mjs`),
reading each stack's compiled `definition.commands` so it cannot drift from what
actually runs. It also enforces the minimum table above.

> **Its one trap.** The checker treats `dude <word>` inside any code span or code
> fence as a command the skill tells the agent to run — that is what lets it see
> `dude security scan` in a fenced block. So writing *about* a command a stack
> lacks, in backticks, fails the check: "this stack has no `dude up`" reads as a
> reference to `dude up`. Say it without backticks. Prose outside code is not
> scanned, precisely because every skill opens with "are you inside a dude
> project?".

## Skills verify their own output

Every `create-*` skill ends with a real verification step, not "you're done":

```bash
dude lint --format json     # what broke, where, under which code
dude explain <CODE>         # why that rule exists and how to satisfy it
```

This is the point of the pair — see the lint section of `CLAUDE.md`. A skill that
generates code without checking it against the rules the stack enforces is
shipping the guesswork the rules exist to remove.

## Stack-agnostic vs stack-specific

Before writing a skill, check whether react-fastapi and react-django ship an
identical copy of it. If they do, it is stack-agnostic — copy it verbatim rather
than paraphrasing, so the copies stay diffable. Today that set is
`clean-branches`, `fix-issues`, `create-jira-issue`, `draft-email`,
`security-scan`, `verify-security-fixes`.

Two things that set has taught us, both worth respecting:

- **`security-scan` is agnostic except one line.** Its triage table names the
  source directories that count as fixable in-repo (`backend/`/`frontend/` on the
  React stacks, `fastmcp/app/` on fastmcp). That line is genuinely per-stack;
  everything else must stay verbatim. "Identical between the two React stacks"
  can mean "both are React", not "stack-agnostic" — `create-page` is the other
  case of that, and it must **not** be copied to a non-React stack.
- **`security-scan` requires `create-jira-issue`.** It reads the saved Jira
  project key from that skill's file. Ship the pair, or the copied skill grows a
  second, bespoke config mechanism.

A stack shipping any Jira-driven skill (`fix-issues`, `create-jira-issue`,
`security-scan`) also needs the `mcp__atlassian__*` entries in its
`.claude/settings.json` allowlist — otherwise the scaffolded project prompts on
every MCP call and the skill is unusable unattended.

`create-*` skills are stack-specific by nature: they encode that stack's layout
and rules. `create-page` happens to be identical between the two React stacks —
that is a coincidence of both being React frontends, not a licence to copy it
into tauri.

> If a genuinely stack-agnostic skill starts drifting between copies, that is the
> signal to do for skills what `defineLintCommand()` did for commands: ship it
> from one place. It is not worth it yet at two-to-six copies of a static file.
