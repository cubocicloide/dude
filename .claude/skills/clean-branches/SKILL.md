# Skill: clean-branches

Use this skill to prune merged and stale branches from both the local clone and
the remote (`origin`).

---

## Step 1 — Fetch and prune remote tracking refs

```bash
git fetch --prune
```

This removes any `origin/<branch>` refs that no longer exist on GitHub.

---

## Step 2 — List merged branches (local)

```bash
# Branches already merged into master
git branch --merged master | grep -v '^\*\|master\|main'
```

Review the list. Do **not** delete branches you recognise as in-progress work
that just happens to have been rebased onto master.

---

## Step 3 — Delete merged local branches

```bash
git branch --merged master \
  | grep -v '^\*\|master\|main' \
  | xargs -r git branch -d
```

---

## Step 4 — Identify stale remote branches via GitHub

Use the GitHub MCP tool to list open and closed branches and identify ones that
are old, have no open PR, and have been inactive:

```
mcp: github_repo → list branches
```

For each candidate branch, check whether a PR exists:

```
mcp: github_repo → list pull requests (state: all, head: <branch>)
```

A branch is safe to delete remotely when:
- Its PR is merged or closed, **or**
- It has no associated PR and has had no commits in the last 30 days.

---

## Step 5 — Delete stale remote branches

```bash
git push origin --delete <branch-name>
```

Or via the GitHub MCP tool:

```
mcp: github_repo → delete branch → <branch-name>
```

---

## Step 6 — Confirm

```bash
git branch -a   # verify local list is clean
```

```
mcp: github_repo → list branches  # verify remote list
```

---

## Safety rules

- Never delete `master` or `main`.
- Never delete a branch that has an **open** PR.
- When in doubt, leave it — branches are cheap.
