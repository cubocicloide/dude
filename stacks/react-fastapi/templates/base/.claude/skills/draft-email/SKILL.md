---
name: draft-email
description: Draft a formal email and save it as a Markdown file in private/messages/. Use when asked to write, draft, or compose an email.
disable-model-invocation: false
allowed-tools: "Write Read Bash(date) Bash(ls *) Bash(git *)"
---

# Draft Formal Email

## Context

!`date "+%Y-%m-%d"`
!`git branch --show-current`
!`ls private/messages/ 2>/dev/null || echo "(no existing messages)"`

## Conventions

**File format:**
```markdown
# Email — <short description of the email>

---

**To:** <recipient name or role>
**Cc:** <if applicable — omit line if not needed>
**Subject:** <Project name — concise subject>
**Date:** <YYYY-MM-DD>

---

<body>

Best regards,
<Your Name>
```

**Filename:** `private/messages/<kebab-case-description>.md`
- Descriptive, not generic: `api-handover.md`, `deploy-blocker.md`
- No date prefix in filename

**Tone and style:**
- Formal but not stiff — direct, professional, collegial
- English
- No filler phrases ("I hope this email finds you well", "Please feel free to")
- Lead with the main point, provide context after
- Use Markdown formatting (bold, bullet lists) where it aids clarity

**Signature:** always `Best regards,\n<Your Name>`

> **Note**: replace `<Your Name>` with your actual name the first time you use this skill in a new project — or update this file to hardcode it.

---

## Step 1 — Gather information

Before drafting, make sure you have:
- **Recipient** (name, role, or team)
- **Purpose** (what action or information is this email for?)
- **Key points** to cover (listed by the user, or inferred from context)
- **Tone** (default: formal — adjust if user says "friendly" or "assertive")
- **Attachments or references** to mention (links, docs, issues)

If any of these is unclear and cannot be inferred from context, ask before drafting.

## Step 2 — Draft the email

Write the full email following the format above. Apply these structural rules by purpose:

**Informational / handover email** (sharing deliverables, status updates):
- Open with what you are sharing and why
- Provide relevant context or background the recipient needs
- List key details, constraints, or next steps clearly
- Close with an offer to clarify or reconnect

**Request / action required email** (asking for something, flagging a blocker):
- Open with the specific request or issue — one sentence
- Explain why it is needed and the impact if not addressed
- Provide all information the recipient needs to act (no back-and-forth)
- State a deadline or urgency level if applicable
- Close with a clear call to action

**Follow-up / reminder email**:
- Reference the previous communication briefly
- State what is still pending and why it matters now
- Keep it short — no need to repeat full context already shared

**Technical clarification email** (explaining architecture, processes, decisions):
- Lead with the conclusion or recommendation, then explain
- Use structured sections (##) for complex topics
- Include concrete examples, file paths, or command references where helpful
- Anticipate follow-up questions and address them proactively

## Step 3 — Review

Show the drafted email in full. Ask the user:
> "Does this look right, or would you like to adjust the tone, add/remove points, or change any details?"

Wait for explicit confirmation or edits before saving.

## Step 4 — Save

Save the file to `private/messages/<kebab-case-description>.md`.

Confirm: show the filename and the first line of the saved content.
