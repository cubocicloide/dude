---
name: verify-security-fixes
description: After a security fix PR is merged, verify that the targeted findings are resolved, remove them from the baseline, and close the corresponding Jira issues — all in a single scan run.
disable-model-invocation: false
allowed-tools: "Bash(git *) Bash(dude *) Bash(docker *) Bash(cat *) Read Write mcp__atlassian__getJiraIssue mcp__atlassian__getTransitionsForJiraIssue mcp__atlassian__transitionJiraIssue mcp__atlassian__addCommentToJiraIssue"
---

# Verify Security Fixes

After a security fix PR is merged into `develop`, this skill:

1. Fetches one or more Jira issues and extracts the rule_id(s) from their descriptions.
2. Runs **a single `dude security verify` scan** for all rule_ids at once.
3. Removes resolved findings from `security/baseline.json` and commits.
4. Closes the Jira issues whose findings are fully resolved.

Run this on `develop` **after** the fix PR has been merged.

## Usage

```
/verify-security-fixes PROJ-52
/verify-security-fixes PROJ-52 PROJ-55 PROJ-59
```

---

## Step 0 — Prerequisites

### Project root

```bash
find . -maxdepth 3 -name "dude.json" | head -1
```

If not found, report: _"No dude.json found — are you inside a dude project?"_ and stop.

### Current branch

```bash
git branch --show-current
```

Must be `develop` (or a branch that tracks `develop`). If not, warn:
_"This skill should run on develop after the fix PR is merged."_ — ask whether to continue anyway.

### Docker

```bash
docker info > /dev/null 2>&1 && echo "ok" || echo "not running"
```

If not running, stop with: _"Docker is required for the scan. Start Docker and retry."_

---

## Step 1 — Fetch issues and extract rule_ids

For each issue key provided by the user:

1. Call `getJiraIssue` to read the full issue.
2. Parse the description for the `**Rule**: <rule_id>` line — this is the rule_id to verify.
3. Also note `**Fingerprint**: <fingerprint>` for the summary report.
4. If the description does not contain a `**Rule**:` line, fall back to parsing the summary
   field: `[security] <tool>: <short title> (<severity>)` — derive the rule_id from `<short title>`.
5. If no rule_id can be extracted, report the issue key with a warning and skip it.

Collect all unique rule_ids across all issues into one flat list (`R1`, `R2`, …).

Show the mapping before proceeding:

| Issue | Rule ID | Fingerprint |
|-------|---------|-------------|
| PROJ-52 | B105 | a3f9c1d2 |
| PROJ-55 | CVE-2026-33750 | e7b2f041 |

---

## Step 2 — Run a single verify scan

From `PROJECT_ROOT`:

```bash
dude security verify --rule-id <R1>,<R2>,... --remove-resolved
```

One full scan run, results filtered per rule_id.

- **Exit 0**: all specified rule_ids are resolved.
- **Non-zero exit**: at least one rule_id is still present — capture the full output.

---

## Step 3 — Decide outcome

Inspect the `dude security verify` output for each rule_id:

| Outcome | Criteria |
|---------|----------|
| **resolved** | Output shows `✓ RESOLVED` for this rule_id |
| **still present** | Output shows `✗ STILL PRESENT` for this rule_id |

Classify each issue accordingly:
- Issues whose **all** rule_ids are resolved → **fully resolved**
- Issues where at least one rule_id is still present → **not yet fixed**

If **no** rule_ids are resolved, do not touch the baseline. Report to the user and stop.

---

## Step 4 — Commit baseline update

`--remove-resolved` already modified `security/baseline.json` in memory; commit it:

```bash
git add security/baseline.json
git commit -m "fix(security): remove resolved findings from baseline — <issue list>"
git push origin develop
```

Where `<issue list>` is a space-separated list of all **fully resolved** issue keys.

If git reports nothing to commit (e.g. `--remove-resolved` found nothing to remove),
skip this step and note it in the summary.

---

## Step 5 — Close fully-resolved Jira issues

For each **fully resolved** issue:

1. `getTransitionsForJiraIssue` → find the transition whose name matches `Done` (case-insensitive).
2. `transitionJiraIssue` to that transition ID.
3. `addCommentToJiraIssue`:
   > Security finding verified as resolved by `dude security verify` on `<date>`.
   > Baseline updated: fingerprint `<fingerprint>` removed from `security/baseline.json`.

If the "Done" transition is not found (e.g. issue is already Done, or workflow differs),
log a warning and skip — do **not** fail the skill.

---

## Step 6 — Report

```
Verify security fixes — complete
══════════════════════════════════════════════════════════

Resolved (N rule_id(s) across M issue(s))
  PROJ-52  B105       fingerprint a3f9c1d2 removed from baseline → Done
  PROJ-55  CVE-2026-33750  fingerprint e7b2f041 removed from baseline → Done

Still present (K finding(s))
  PROJ-59  G202  file.py:42 — <message>
            → The finding was not eliminated; the fix may need revision.

Baseline
  security/baseline.json updated and pushed to develop.
  (no changes needed — no resolved fingerprints found)   ← if applicable

Jira
  PROJ-52 → Done
  PROJ-55 → Done
  PROJ-59 → left open (still present)
```

---

## Notes

- Running one scan for N issues costs the same as one scan for 1 issue — this is the
  main efficiency gain over verifying each issue separately.
- `--rule-id` accepts comma-separated values: `B105,G202,CVE-2026-33750` — all are
  checked in a single invocation.
- If a rule_id appears in multiple issues, it is included only once in the
  `--rule-id` list; both issues benefit from the single result.
- The skill does **not** re-run `dude security scan` — it calls `dude security verify`,
  which is scope-aware and only reports on the baseline entries that match the provided
  rule_ids.
- If Docker or the scan fails entirely, no baseline changes are committed.
