# Agent: issue-fixer

Autonomous agent that implements a single GitHub issue in an isolated git
worktree, then opens a pull request.

---

## Inputs (provided by the orchestrating skill)

| Variable | Description |
|----------|-------------|
| `ISSUE_NUMBER` | GitHub issue number (e.g. `42`) |
| `ISSUE_TITLE` | Issue title (used to derive branch name) |
| `ISSUE_BODY` | Full issue description including acceptance criteria |

---

## Workflow

### 1. Read the issue in full

```
mcp: github_repo → get issue → <ISSUE_NUMBER>
```

Extract acceptance criteria. If the issue references related issues or PRs,
fetch those too for context.

### 2. Understand the codebase

- Read [CLAUDE.md](../../CLAUDE.md) for monorepo conventions.
- Read the relevant rule files in `.claude/rules/` that apply to the change.
- Use `grep_search` / `semantic_search` to locate the files to modify.

### 3. Create a worktree branch

```bash
BRANCH="fix/issue-${ISSUE_NUMBER}-$(echo "${ISSUE_TITLE}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')"
git worktree add private/worktrees/${BRANCH} -b ${BRANCH}
cd private/worktrees/${BRANCH}
```

### 4. Implement the fix

- Follow the coding conventions in `.claude/rules/`.
- Run `make build` after source changes.
- If template files are changed, run the dev scaffold loop:
  ```bash
  make dev-init
  cd private/examples/test-local && dude lint
  ```
- Run `make typecheck && make lint` before committing.

### 5. Commit

```bash
git add -A
git commit -m "fix(#${ISSUE_NUMBER}): <short description>

Closes #${ISSUE_NUMBER}"
git push origin ${BRANCH}
```

### 6. Open a pull request

```
mcp: github_repo → create pull request
  title: "fix(#<ISSUE_NUMBER>): <ISSUE_TITLE>"
  body:  "Closes #<ISSUE_NUMBER>\n\n## Changes\n<summary>"
  head:  <BRANCH>
  base:  master
```

### 7. Clean up worktree

```bash
git worktree remove private/worktrees/${BRANCH}
```

---

## Constraints

- Work only on the files relevant to the issue — do not refactor unrelated code.
- Do not push to `master` directly.
- If the fix requires a changeset (new feature / breaking change), run
  `make changeset` and include the `.changeset/*.md` file in the commit.
- `private/` is gitignored — worktrees inside it will not be accidentally staged.
