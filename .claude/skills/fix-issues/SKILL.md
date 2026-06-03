# Skill: fix-issues

Use this skill when asked to implement one or more open GitHub issues.
Each issue is handled in an isolated git worktree by the `issue-fixer` agent.

---

## Step 1 — Fetch open issues

```
mcp: github_repo → list issues (state: open)
```

Filter to issues labelled `bug` or `enhancement` unless the user specifies
otherwise. Present the list and confirm which ones to fix.

---

## Step 2 — For each issue, spawn an `issue-fixer` agent

Pass the agent:
- Issue number and title
- Issue body (requirements / acceptance criteria)
- Target branch name: `fix/issue-<number>-<slug>` (slug = kebab-cased title)

The agent works autonomously in its own worktree (see `issue-fixer` agent).

---

## Step 3 — Review the resulting PRs

When each agent finishes it opens a PR. Inspect them:

```
mcp: github_repo → list pull requests (state: open)
mcp: github_repo → get pull request details → <pr_number>
mcp: github_repo → list pull request files → <pr_number>
```

---

## Step 4 — Merge approved PRs

```
mcp: github_repo → merge pull request → <pr_number>  (squash)
```

After merge, delete the feature branch:

```bash
git push origin --delete fix/issue-<number>-<slug>
```

---

## Step 5 — Close the issue (if not auto-closed by PR)

```
mcp: github_repo → update issue → state: closed
```
