---
name: clean-branches
description: Identify merged and stale branches, confirm, then delete the selected branches.
disable-model-invocation: false
allowed-tools: 'Bash(git *)'
---

# Clean branches

Fetch and prune, then list local and remote branches merged into the repository's
base branch plus local branches without an upstream that have been inactive for
30 days. Exclude protected branches and the current branch. Present the list and
wait for explicit confirmation before deleting anything. Use `git branch -d`
for local branches and `git push origin --delete` for confirmed remote branches;
never force-delete without separate confirmation.
