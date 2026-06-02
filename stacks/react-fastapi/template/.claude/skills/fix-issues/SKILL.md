---
name: fix-issues
description: Fix 1–5 Jira issues. Single-issue uses a standard flow; multiple issues run parallel agents in isolated git worktrees, then consolidate into one branch and open a PR.
disable-model-invocation: false
allowed-tools: "Bash(git *) Bash(dude *) Bash(docker *) Bash(cat *) Bash(find *) Read Write mcp__atlassian__getJiraIssue mcp__atlassian__getTransitionsForJiraIssue mcp__atlassian__transitionJiraIssue mcp__atlassian__addCommentToJiraIssue mcp__atlassian__createPullRequest mcp__atlassian__getRepository PushNotification"
---

# Fix Issues (Router + Parallel + Consolidation)

Fixes 1–5 Jira issues. For a single issue a standard single-agent flow is
used. For multiple issues, agents run in parallel using isolated git worktrees
and their branches are merged into one consolidated branch before the PR is
created.

Each issue is routed to the appropriate agent based on its labels:
- Issues labelled `security` → **`security-fixer`** agent
- All other issues (features, bugs, tasks) → **`issue-fixer`** agent

## Usage

```
/fix-issues PROJ-52
/fix-issues PROJ-52 PROJ-55 PROJ-59
/fix-issues PROJ-52 PROJ-53 PROJ-54 PROJ-57 PROJ-60
```

## Validation

If more than 5 issue IDs are provided, stop and ask the user to split the
request into batches of at most 5.

---

## Step 0 — Autodiscovery

### Project root

```bash
find . -maxdepth 3 -name "dude.json" | head -1
```

If not found, report: _"No dude.json found — are you inside a dude project?"_ and stop.

### Jira + Bitbucket configuration

Read `## Saved configuration` at the bottom of this file.

- If `workspace`, `repo`, and `jira-project` keys are present, use them silently.
- If any are absent, ask:
  - **"What is the Bitbucket workspace slug?"** (e.g. `myteam`)
  - **"What is the repository slug?"** (e.g. `my-project`)
  - **"What is the Jira project key?"** (e.g. `PROJ`)
  - Then offer to save all three in this file's `## Saved configuration` section.

Resolve automatically:
- **Jira URL**: `getAccessibleAtlassianResources` → first site URL
- **Current user**: `atlassianUserInfo` → display name (used in PR description)

---

## Phase 0 — Route: fetch issues and pick agents

Before launching any fix agent, fetch all issues with `getJiraIssue`
(in parallel if N>1) and read `labels` for each.

For each issue, select the agent:
- `labels` contains `security` → `security-fixer`
- otherwise → `issue-fixer`

Build a per-issue map: `{ issue_id: agent_type }`.

### Branch naming

- **Single issue (N=1)**: branch = lowercase issue key (e.g. `proj-52`)
- **Multiple issues (N>1)**:
  - Individual branches: lowercase issue key per agent
  - Consolidated branch: `fix/<key1>-<key2>-...` (keys sorted numerically)
  - If **all** issues are security-labelled: `security/<key1>-<key2>-...`

---

## Phase 1 — Fix agents (parallel for N>1, single for N=1)

Launch one agent **per issue** in the **same message** (so they run in parallel
when N>1), using the agent type determined in Phase 0. Each agent uses
`isolation: "worktree"` to get its own isolated git checkout.

Prompt template for each agent:

> Fix Jira issue `<ISSUE_ID>` in PARALLEL MODE.
>
> Project root: `<PROJECT_ROOT>`
> Jira URL: `<JIRA_URL>`
> Bitbucket workspace: `<workspace>`, repo: `<repo>`
>
> PARALLEL MODE: create branch `<issue-id>` from `develop`, apply fix, push.
> Do NOT create a PR. Do NOT transition the Jira issue.

Wait for **all agents** to finish before proceeding.

Collect from each agent:
- Branch name pushed
- Files changed
- Commit hash
- Any `BLOCKED: <reason>` if the agent could not complete the fix

---

## Phase 2 — Consolidation (N>1 only)

For a **single issue**, skip this phase — go directly to Phase 3 using the
agent's own branch.

For **multiple issues**, collect branch names, then:

```bash
git fetch origin
git checkout develop && git pull origin develop --rebase
git checkout -b fix/<key1>-<key2>-...

git merge --no-ff <key1>
git merge --no-ff <key2>
# … one per agent branch
```

If any merge produces a conflict:
- Report which branch caused it and the conflicting files.
- Stop — do **not** force-push or discard changes.
- Ask the user how to proceed.

---

## Phase 3 — Tests

Run on the consolidated branch (or the single agent branch):

```bash
dude lint
```

If the project has a test command (check `Makefile`, `package.json` scripts, or
`dude help`), run it next:

```bash
dude test       # if available
# or:
cd backend && python -m pytest
cd frontend && pnpm test
```

If any step fails, report the output and stop — do **not** create a PR.

---

## Phase 4 — Push and create one PR

```bash
git push -u origin <source-branch>
```

Create a pull request via `createPullRequest`:

- **Title**:
  - N=1: `[<ISSUE_ID>] <issue summary>`
  - N>1: `[<KEY1>, <KEY2>, …] <short batch description>`
- **Source branch**: `<source-branch>`
- **Destination branch**: `develop`
- **Description**:
  ```
  ## Summary
  <bullet points per issue: what was changed and why>

  ## Issues
  - [<ISSUE_ID>] <summary> — <Jira URL>/<ISSUE_ID>
  - …

  ## Test plan
  - [ ] dude lint: ✓
  - [ ] tests: ✓
  ```
- **Close source branch**: `true`

---

## Phase 5 — Transition all Jira issues

For each issue, call `getTransitionsForJiraIssue` → find a transition whose
name contains "Review" or "Peer review" (case-insensitive) →
`transitionJiraIssue`.

If no matching transition is found (the workflow may differ), skip silently.

---

## Phase 6 — Report

```
Fix complete
══════════════════════════════════════════════════════

Branch
  <branch-name>

Issues (N)
  <KEY> [issue-fixer]    — commit <hash> — <description>
  <KEY> [security-fixer] — commit <hash> — <description>

Tests
  dude lint:  ✓
  dude test:  ✓

Pull request
  <PR URL>

Jira
  <KEY> → In Review
  <KEY> → In Review
```

---

## Notes

- Each agent runs in its own git worktree (`isolation: "worktree"`) — git
  operations never conflict during Phase 1.
- `security/baseline.json` is **not** touched by individual agents. Baseline
  cleanup is handled by `verify-security-fixes` after the PR is merged.
- Each agent calls `PushNotification` when it completes so you are notified
  immediately as each fix lands.
- Agents marked `BLOCKED` are reported in Phase 6 but do not prevent the PR
  from being created for the remaining issues.

---

<!-- ------------------------------------------------------------------ -->
<!-- Everything below this line is written automatically by the skill.   -->
<!-- Do not edit manually.                                               -->
<!-- ------------------------------------------------------------------ -->
