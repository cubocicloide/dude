---
name: triage-issues
description: Triage open GitHub issues — assess validity, detect duplicates, apply stack/component labels, and flag missing repros. Proposes actions for the maintainer to approve; never closes without confirmation.
---

# Skill: triage-issues

Use this skill to work through the open-issue backlog on `cubocicloide/dude`.
It runs **on your machine, on demand**, using your own Claude session — so any
maintainer or contributor can share the triage load with their own account.

It is the read-and-label counterpart to the `fix-issues` skill (which
implements fixes). This skill **analyses and organises**; it never writes code
and never closes an issue without your explicit go-ahead.

Uses the `gh` CLI throughout, so it works for anyone with `gh` authenticated —
no special MCP server required.

---

## Step 1 — Fetch the untriaged backlog

Untriaged issues are the ones still carrying the `triage` label the issue forms
apply on creation:

```bash
gh issue list --repo cubocicloide/dude --state open --label triage \
  --json number,title,labels,author,createdAt,body --limit 50
```

If the maintainer named specific issues, scope to those instead. Present the
list and confirm the batch before proceeding.

---

## Step 2 — Analyse each issue

For each issue, read the body (it follows the bug-report form: Area, Stack,
Diagnostics from `dude info`, Command, Expected/Actual, Repro). Decide:

| Question | How to judge |
|----------|--------------|
| **Valid?** | Is there enough to act on — a clear symptom + a command + diagnostics? |
| **Duplicate?** | Search existing issues (Step 3) before anything else. |
| **Which stack/component?** | From the Stack field / `dude info` → a `stack:<id>` label, or `stack:core`. |
| **Enough to reproduce?** | If no repro or no `dude info`, it needs `needs-repro`. |
| **Severity/kind?** | Confirm `bug` vs mis-filed `enhancement`. |

---

## Step 3 — Check for duplicates (do this before labelling)

Search open **and** closed issues for overlap, using key terms from the title:

```bash
gh issue list --repo cubocicloide/dude --state all --search "<3-4 key terms>" \
  --json number,title,state --limit 20
```

If you find a likely duplicate, **do not close it yourself**. Propose to the
maintainer: comment linking the original and apply the `duplicate` label, then
close *only after they confirm*. Duplicate false-positives alienate first-time
reporters — err toward asking.

---

## Step 4 — Propose actions (await approval)

Present a compact table for the batch — one row per issue — with your proposed
action. Do **not** apply anything yet:

| # | Title | Proposal |
|---|-------|----------|
| 42 | dude up crashes… | label `stack:react-fastapi`, remove `triage` |
| 43 | how do I…? | not a bug → suggest converting to a Discussion |
| 44 | (empty) | comment asking for `dude info` + repro, label `needs-repro` |
| 45 | same as #42 | likely duplicate of #42 → comment + `duplicate`, close after OK |

Wait for the maintainer to confirm, adjust, or drop rows.

---

## Step 5 — Apply the approved actions

Only the confirmed ones. Examples:

```bash
# Label + clear triage
gh issue edit <n> --repo cubocicloide/dude \
  --add-label "stack:react-fastapi" --remove-label "triage"

# Ask for a reproduction
gh issue comment <n> --repo cubocicloide/dude \
  --body "Thanks for the report! Could you add the output of \`dude info\` and the exact steps to reproduce? Marking as needs-repro until then."
gh issue edit <n> --repo cubocicloide/dude --add-label "needs-repro"

# Flag a duplicate (close only after explicit confirmation)
gh issue comment <n> --repo cubocicloide/dude \
  --body "This looks like a duplicate of #<orig>. Following up there — thanks!"
gh issue edit <n> --repo cubocicloide/dude --add-label "duplicate"
gh issue close <n> --repo cubocicloide/dude --reason "not planned"
```

---

## Step 6 — Hand off the actionable ones

For issues that are valid, reproducible, and ready to implement, either:

- label them `agent:fix` (or note them) so a fix session can pick them up, and/or
- run the **`fix-issues`** skill to implement them in isolated worktrees and
  open PRs.

---

## Guardrails

- **Never close a valid issue** without maintainer confirmation.
- **Never auto-close duplicates** on suspicion alone — propose, then confirm.
- Prefer asking for missing info over guessing intent.
- Keep comments warm and concise; contributors are volunteers.
- This skill does not modify code. Fixing is `fix-issues`' job.
