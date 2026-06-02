---
name: security-scan
description: Run the full security scan (bandit + semgrep + trivy-fs + trivy-image), triage new findings, attempt code fixes for HIGH/CRITICAL issues, create Jira bugs for unfixable findings, and update the baseline.
disable-model-invocation: false
allowed-tools: "Bash(git *) Bash(dude *) Bash(docker *) Bash(cat *) Bash(find *) Read Write mcp__atlassian__createJiraIssue mcp__atlassian__searchJiraIssuesUsingJql mcp__atlassian__atlassianUserInfo mcp__atlassian__getAccessibleAtlassianResources"
---

# Security Scan

Runs `dude security scan`, triages new findings, attempts code fixes for
HIGH/CRITICAL in-repo issues, creates Jira bugs for unfixable findings,
and updates the baseline with `dude security accept`.

---

## Step 0 — Autodiscovery

### Project root

Locate `dude.json` by searching from the current working directory upward:

```bash
find . -maxdepth 3 -name "dude.json" | head -1
```

If not found, report: _"No dude.json found — are you inside a dude project?"_ and stop.

### Docker

```bash
docker info > /dev/null 2>&1 && echo "ok" || echo "not running"
```

If Docker is not running, report: _"Docker is required for security scanners (trivy, semgrep). Start Docker and retry."_ and stop.

### Jira configuration

Read `.claude/skills/create-jira-issue/SKILL.md` and look for `## Saved configuration`.

- If a `project` key is present, use it silently.
- If absent, ask the user: **"What is the Jira project key for security issues? (leave blank to skip Jira issue creation)"**
  - If the user provides a key, offer to save it in `create-jira-issue/SKILL.md` (same mechanism as that skill).
  - If the user leaves blank, proceed without creating Jira issues.

Resolve reporter and Jira URL automatically:
- **Reporter**: `atlassianUserInfo` → account ID
- **Jira URL**: `getAccessibleAtlassianResources` → first site URL

---

## Step 1 — Run the scan

From the project root:

```bash
dude security scan
```

This runs all adapters (bandit, semgrep, trivy-fs, trivy-image), classifies findings into **new / known / resolved**, and writes:
- `private/sast-reports/latest/findings.json` — all findings
- `private/sast-reports/latest/summary.md` — human-readable report

Read `private/sast-reports/latest/summary.md` and show it to the user.

---

## Step 2 — Triage new findings

Read `private/sast-reports/latest/findings.json` and filter entries where `status = "new"`.

For each new finding, classify it as one of:

| Class | Criteria |
|-------|----------|
| **fixable** | HIGH or CRITICAL severity, source is in `backend/` or `frontend/` (not a dependency CVE), fix is clear from the finding |
| **jira-only** | HIGH or CRITICAL, but a dependency CVE or infrastructure issue — cannot be fixed in-repo |
| **accept** | LOW or MEDIUM severity, or a false positive |

Present the classification table to the user before proceeding:

| # | Tool | Severity | File | Title | Action |
|---|------|----------|------|-------|--------|
| … | … | … | … | … | fixable / jira-only / accept |

Ask: _"Does this triage look right? Adjust any action before I proceed."_

Wait for confirmation.

---

## Step 3 — Attempt code fixes (fixable findings)

For each finding classified as **fixable**, in order of severity (CRITICAL first):

1. Read the affected file at the reported line.
2. Understand the issue from the finding's `message` and `rule_id`.
3. Apply the minimal correct fix.
4. Re-read the fixed lines and confirm the pattern is resolved.
5. Report: `✓ Fixed: <file>:<line> — <rule_id>`

If a fix cannot be applied safely (unclear root cause, touching shared infra code, etc.), reclassify the finding as **jira-only** and note the reason.

Do **not** commit changes — leave that for the user to review.

---

## Step 4 — Create Jira issues (jira-only findings)

Skip this step if no Jira project key is configured.

For each **jira-only** finding:

1. Check for an existing open issue first:
   ```jql
   project = <KEY> AND statusCategory != Done AND summary ~ "<tool> <rule_id>"
   ```
   If a match exists, skip creation and note the existing issue key.

2. Create a Bug issue with:
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
     <message from finding>

     ## Why not fixed inline
     <reason: dependency CVE / infrastructure / unclear root cause>

     ## Suggested remediation
     <component or package to update, or link to advisory if available>

     ## References
     - Scan timestamp: <timestamp from findings.json>
     ```
   - **Labels**: `security` + severity label (`critical`, `high`) + `<tool>`
   - **Priority**: CRITICAL → Blocker, HIGH → High

3. Note the created issue key.

---

## Step 5 — Accept remaining findings

For all findings classified as **accept** (and any **jira-only** findings that now have a Jira issue):

```bash
dude security accept
```

This merges new findings into `security/baseline.json` so they are tracked as known.

---

## Step 6 — Summary report

Show a final summary:

```
Security scan complete
══════════════════════════════════════════
Fixed in-repo:   <n> findings
Jira issues:     <n> created, <n> skipped (already existed)
Accepted:        <n> findings added to baseline
Resolved:        <n> findings no longer present
──────────────────────────────────────────
Files modified:  <list of files changed by fixes, if any>
Next steps:
  • Review and commit the code fixes above
  • Run `dude security verify` after merging to confirm baseline is clean
```

---

## Notes

- Docker must be running — trivy and semgrep run in containers.
- The skill does **not** commit or push anything.
- Use `dude security verify` after merging to confirm the baseline is still consistent.
- Adapter scope can be narrowed: `dude security scan --only bandit` if a full scan is too slow.
