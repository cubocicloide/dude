---
name: clean-branches
description: Identify merged and stale branches, list them, ask for confirmation, then delete selected ones
disable-model-invocation: false
allowed-tools: "Bash(git *)"
---

# Clean Branches

## Step 0 — Clean up stale worktrees

Before identifying branch candidates, check for stale or abandoned worktrees:

```bash
git worktree list
```

Flag any worktree under `.claude/worktrees/` as a **Claude agent worktree** — these are created automatically during agent runs and are safe to remove when no longer active.

For each stale worktree:
1. Check if the directory exists on disk
2. Remove it with `git worktree remove -f -f <path>` (double `-f` required for locked worktrees)
3. After removal, include the associated branch in the candidate list for Step 1

If any worktree removal fails, warn the user and skip that branch from deletion.

## Current state

!`git fetch --prune 2>&1 | tail -5`
!`git branch --show-current`

## Step 1 — Identify candidates

Run the following commands and collect results:

```bash
# Branches merged into main (local)
git branch --merged main | grep -v '^\*' | grep -v 'main$' | grep -v 'develop$'

# Branches merged into develop (local)
git branch --merged develop | grep -v '^\*' | grep -v 'main$' | grep -v 'develop$'

# Remote branches merged into main
git branch -r --merged main | grep -v 'origin/main$' | grep -v 'origin/develop$' | grep -v 'origin/HEAD'

# Remote branches merged into develop
git branch -r --merged develop | grep -v 'origin/main$' | grep -v 'origin/develop$' | grep -v 'origin/HEAD'

# Stale local branches (no upstream, last commit older than 30 days)
git for-each-ref --format='%(refname:short) %(upstream:short) %(committerdate:iso)' refs/heads \
  | awk '{if ($2 == "" && $3 != "" && $3 < "'$(date -v-30d +%Y-%m-%d 2>/dev/null || date -d '30 days ago' +%Y-%m-%d)'") print $1}'
```

## Step 2 — Present the list

After collecting results, deduplicate and present a clear table:

| #   | Branch | Type | Last Commit | Merged into |
| --- | ------ | ---- | ----------- | ----------- |

**Types:**

- `merged-local` — local branch merged into main or develop
- `merged-remote` — remote tracking branch merged into main or develop
- `stale-local` — local branch with no upstream and no commits in 30+ days

Always **exclude** from the list: `main`, `develop`, `sandbox`, the current branch, and any branch the user is currently on.

## Step 3 — Ask for confirmation

Present the list, then ask:

> "Which branches should I delete?
>
> - Type **all** to delete everything listed
> - Type **none** to cancel
> - Type branch numbers or names to keep (exceptions), e.g. `keep 3,5` or `keep feature/old-experiment`"

Wait for the user's explicit answer before proceeding.

## Step 4 — Delete confirmed branches

Based on the user's response:

- For **local** merged/stale branches: `git branch -d <branch>` (use `-D` only if `-d` fails and user confirms)
- For **remote** branches: `git push origin --delete <branch>` (strip the `origin/` prefix)

After deletion, show a summary:

```
Deleted: <list>
Skipped: <list>
```

## Rules

- Never delete `main`, `develop`, `dev`, `test`, `staging`, or the currently checked-out branch
- Never force-delete (`-D`) without explicit user confirmation per branch
- Always confirm before any remote deletion — remote deletions are not reversible locally
- If no candidates are found, report "No stale or merged branches found" and stop
