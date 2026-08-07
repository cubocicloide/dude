---
name: security-scan
description: Run the full security scan (bandit + semgrep + trivy-fs + trivy-image), triage new findings, fix HIGH/CRITICAL in-repo issues in parallel branches, open a PR, create Jira bugs for unfixable findings, and update the baseline.
disable-model-invocation: false
allowed-tools: "Bash(git *) Bash(dude *) Bash(docker *) Bash(find *) Bash(cat *) Bash(mkdir *) Bash(rm *) Read Write mcp__atlassian__createJiraIssue mcp__atlassian__searchJiraIssuesUsingJql mcp__atlassian__atlassianUserInfo mcp__atlassian__getAccessibleAtlassianResources mcp__atlassian__createPullRequest PushNotification"
---

# Security Scan

Runs `dude security scan`, triages new findings, fixes HIGH/CRITICAL in-repo
issues via parallel agents in isolated git worktrees, consolidates into one
branch, opens a PR, creates Jira bugs for unfixable findings, and updates the
baseline with `dude security accept`.

---

## Step 0 — Autodiscovery

### Project root

Locate `dude.json` by searching from the current working directory upward:

```bash
find . -maxdepth 3 -name "dude.json" | head -1
```

If not found, report: _"No dude.json found — are you inside a dude project?"_ and stop.
Set `PROJECT_ROOT` to the directory containing `dude.json`.

### Docker

```bash
docker info > /dev/null 2>&1 && echo "ok" || echo "not running"
```

If Docker is not running, report: _"Docker is required (trivy, semgrep). Start Docker and retry."_ and stop.

### Jira configuration

Read `.claude/skills/create-jira-issue/SKILL.md` and look for `## Saved configuration`.

- If a `project` key is present, use it silently.
- If absent, ask: **"What is the Jira project key? (leave blank to skip Jira issue creation)"**
  - If provided, offer to save it in `create-jira-issue/SKILL.md`.
  - If blank, proceed without creating Jira issues.

Resolve automatically — do not ask the user:
- **Reporter**: `atlassianUserInfo` → account ID
- **Jira URL**: `getAccessibleAtlassianResources` → first site URL

### Repository configuration

Read `## Saved configuration` at the bottom of this file.

- If `workspace` and `repo` keys are present, use them silently.
- If absent, ask:
  - **"What is the Bitbucket workspace slug?"** (e.g. `myteam`)
  - **"What is the repository slug?"** (e.g. `my-project`)
  - Then offer to save both in this file (same append mechanism as `create-jira-issue`).

---

## Step 1 — Run the scan

From `PROJECT_ROOT`:

```bash
dude security scan
```

Classifies findings into **new / known / resolved** and writes:
- `private/sast-reports/latest/findings.json`
- `private/sast-reports/latest/summary.md`

Show `summary.md` to the user.

---

## Step 2 — Triage new findings

Read `findings.json`, filter `status = "new"`, classify each:

| Class | Criteria |
|-------|----------|
| **fixable** | HIGH or CRITICAL, source under `fastmcp/app/` (not a dependency CVE), fix is actionable |
| **jira-only** | HIGH or CRITICAL, dependency CVE or infra issue — cannot be fixed in-repo |
| **accept** | LOW or MEDIUM, or false positive |

Present the triage table:

| # | Fingerprint | Tool | Severity | File | Title | Action |
|---|-------------|------|----------|------|-------|--------|
| … | … | … | … | … | … | fixable / jira-only / accept |

Ask: _"Does this triage look right? Adjust any action before I proceed."_

Wait for confirmation. If there are no **fixable** findings, skip Steps 3–5 and go to Step 6.

---

## Step 3 — Fix agents (parallel, one per fixable finding)

### Branch naming

Each fixable finding gets its own branch:

```
security/fix-<fingerprint>
```

where `<fingerprint>` is the first 8 characters of the finding's fingerprint field.

### Launch parallel agents

Launch one **sub-agent per fixable finding in the same message** (so they run in parallel), each with `isolation: "worktree"`.

Prompt template for each agent:

> You are fixing a security finding in an isolated git worktree.
>
> **Project root**: `<PROJECT_ROOT>`
> **Base branch**: `develop`
> **Your branch**: `security/fix-<fingerprint>`
>
> **Finding**:
> - Tool: `<tool>`
> - Rule: `<rule_id>`
> - Severity: `<severity>`
> - File: `<file>` line `<line>`
> - Message: `<message>`
>
> **Instructions**:
> 1. `git fetch origin && git checkout -b security/fix-<fingerprint> origin/develop`
> 2. Read the affected file at the reported line.
> 3. Apply the minimal correct fix that resolves the finding without breaking surrounding logic.
> 4. If the fix is not safe or the root cause is unclear, output `CANNOT_FIX: <reason>` and stop.
> 5. `git add -p` → stage only the relevant changes.
> 6. `git commit -m "fix(security): <rule_id> in <file>"`
> 7. `git push -u origin security/fix-<fingerprint>`
> 8. Output `FIXED: security/fix-<fingerprint> — <one-line description of the fix>`

Wait for **all agents** to finish before proceeding.

Collect results:
- `FIXED: <branch>` → add to **fixed** list
- `CANNOT_FIX: <reason>` → reclassify that finding as **jira-only**

---

## Step 4 — Consolidation

If only one branch was fixed, use it directly as the source branch (skip merge step).

If two or more branches were fixed:

```bash
git fetch origin
git checkout develop && git pull origin develop --rebase
git checkout -b security/fix-<YYYYMMDD>

git merge --no-ff security/fix-<fp1>
git merge --no-ff security/fix-<fp2>
# … one per fixed branch
```

If any merge produces a conflict:
- Report which branch caused it and the conflicting files.
- Stop — do **not** force-push or discard.
- Ask the user how to proceed.

---

## Step 5 — Tests and PR

### Run tests

```bash
dude test
```

If tests fail, report the output and stop — do **not** open a PR.

### Push and open PR

```bash
git push -u origin <source-branch>
```

Create a pull request via MCP:
- **Title**: `[security] Fix <n> HIGH/CRITICAL finding(s) from scan <YYYY-MM-DD>`
- **Source branch**: `<source-branch>`
- **Destination branch**: `develop`
- **Description**:
  ```
  ## Security fixes

  Automated fixes from `dude security scan` run on <date>.

  | Fingerprint | Tool | Severity | File | Fix summary |
  |-------------|------|----------|------|-------------|
  | <fp> | <tool> | <severity> | <file> | <one-line> |

  ## Testing
  - `dude test`: ✓

  ## Baseline
  Remaining findings (jira-only + accept) will be baselined with
  `dude security accept` after this PR is merged.
  ```
- **Close source branch**: `true`

---

## Step 6 — Create Jira issues (jira-only findings)

Skip if no Jira project key is configured.

For each **jira-only** finding:

1. Check for duplicates:
   ```jql
   project = <KEY> AND statusCategory != Done AND summary ~ "<tool> <rule_id>"
   ```
   If a match exists, skip and note the existing key.

2. Create a Bug:
   - **Summary**: `[security] <tool>: <short title> (<severity>)`
   - **Description**:
     ```
     ## Finding

     - **Tool**: <tool>
     - **Rule**: <rule_id>
     - **Severity**: <severity>
     - **File**: <file> (line <line>)
     - **Fingerprint**: <fingerprint>

     ## Description
     <message>

     ## Why not fixed inline
     <reason: dependency CVE / infrastructure / unclear root cause>

     ## Suggested remediation
     <package to update, advisory link, or mitigation>

     ## References
     - Scan timestamp: <timestamp from findings.json>
     ```
   - **Labels**: `security` + `<severity-lowercase>` + `<tool>`
   - **Priority**: CRITICAL → Blocker, HIGH → High

---

## Step 7 — Accept remaining findings

```bash
dude security accept
```

Merges **accept** findings (and **jira-only** findings that now have a Jira issue) into `security/baseline.json`.

---

## Step 8 — Summary report

```
Security scan complete
══════════════════════════════════════════════════
Fixed in-repo (PR):  <n> findings → <PR URL>
Jira issues:         <n> created, <n> already existed
Accepted:            <n> findings added to baseline
Resolved:            <n> findings no longer present
──────────────────────────────────────────────────
Next steps:
  • Review and merge the PR above
  • After merge: run `dude security verify` to confirm baseline is clean
  • Individual fix branches will be deleted when PR is merged
```

---

## Notes

- Docker must be running — trivy and semgrep run in containers.
- The skill does **not** commit or push anything outside the fix agents.
- Adapter scope can be narrowed: `dude security scan --only bandit` if a full scan is too slow.
- Each fix agent runs in its own git worktree (`isolation: "worktree"`) — git operations never conflict between agents.
- `security/baseline.json` is **not** touched by fix agents — baseline is updated only in Step 7 after the PR is ready.

---

<!-- ------------------------------------------------------------------ -->
<!-- Everything below this line is written automatically by the skill.   -->
<!-- Do not edit manually.                                               -->
<!-- ------------------------------------------------------------------ -->

