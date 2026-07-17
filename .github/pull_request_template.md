<!-- Thanks for contributing to dude! Keep this description tight — the checklist
     below maps to the repo's invariants (see CLAUDE.md / CONTRIBUTING.md). -->

## What & why

<!-- What does this change, and why? Link the issue it closes. -->

Closes #

## Type of change

- [ ] Bug fix
- [ ] New feature / stack / command
- [ ] Lint check (with a matching `.claude/rules/` file in the generated project)
- [ ] Docs
- [ ] Chore / refactor / CI

## Checklist

- [ ] Rebuilt the affected package(s) after source changes (`make build`, or a per-filter build)
- [ ] `make check` passes locally (lint + typecheck + test) — or CI is green
- [ ] Added a changeset (`make changeset`) if a **published** package changed (skip for repo-only files: workflows, docs site, `.github/`)
- [ ] Updated docs if commands/behaviour changed — the root `docs/` site, the per-stack `templates/base/docs/`, and the CLAUDE.md command reference
- [ ] For a lint-rule change: updated the matching `templates/base/.claude/rules/<GROUP>/NNN.md`
- [ ] Validated template/lint changes with the dev scaffold loop (`make dev-init` → `dude lint`)

## Notes for reviewers

<!-- Anything reviewers should focus on, trade-offs, follow-ups. Remove if empty. -->
