---
name: create-jira-issue
description: Create a Jira issue. Use whenever the user asks to create, open, log, or file a Jira issue, ticket, or bug report.
disable-model-invocation: false
allowed-tools: "Bash(git *) mcp__atlassian__createJiraIssue mcp__atlassian__searchJiraIssuesUsingJql mcp__atlassian__getJiraIssue mcp__atlassian__lookupJiraAccountId mcp__atlassian__atlassianUserInfo mcp__atlassian__getAccessibleAtlassianResources Write Read"
---

# Create Jira Issue

## Step 0 — Load configuration

Read the `## Saved configuration` section at the bottom of this file.

- If a `project` key is present, use it as the Jira project key. Skip to Step 1.
- If absent, ask the user: **"What is the Jira project key? (e.g. MYPROJ)"** and proceed with the answer.

Resolve the reporter and Jira site automatically — do not ask the user:
- **Reporter**: call `atlassianUserInfo` → use the returned account ID
- **Jira URL**: call `getAccessibleAtlassianResources` → use the first site's URL

## Git context

!`git branch --show-current`
!`git log --oneline -5`

---

## Step 1 — Determine issue type

Ask the user (or infer from context) whether this is a **Bug** or a **Task**.
If ambiguous, ask before proceeding.

---

## Step 2 — Build the issue fields

### BUG

Use when something is broken, incorrect, or behaving unexpectedly.

**Summary format**: `[<component>] <short description of the broken behaviour>`
- Component: `backend`, `frontend`, `e2e`, `deploy`, `security`, `pipeline`
- Max 72 characters. Active voice. No trailing period.
- Examples:
  - `[backend] User creation fails silently when DB connection times out`
  - `[frontend] Table does not refresh after approval action`

**Description template**:
```
## Summary
<One sentence describing what is wrong and the observable impact.>

## Steps to reproduce
1. <First step — be specific: URL, user role, data used>
2. <Second step>
3. <…>

## Expected behaviour
<What should happen.>

## Actual behaviour
<What happens instead. Include error messages, stack traces, or screenshots if available.>

## Environment
- Branch: <current git branch>
- Component: <backend / frontend / e2e / deploy>
- Relevant config: <env vars, feature flags, or settings involved if known>

## Root cause hypothesis
<If known or suspected: which file/function/service is likely responsible.
Reference specific files and line numbers if possible.>

## Suggested fix
<Concrete suggestion for the assignee:
- Which file(s) to look at
- What change is likely needed
- Any gotchas or related code to check
If unknown, write "Under investigation.">

## References
<Links to related issues, PRs, docs, or log output. Remove if empty.>
```

**Labels**: `bug` + component label (e.g. `backend`, `frontend`) + any of: `security`, `e2e`, `ux`, `performance`
**Priority**: infer from impact — Blocker if production is broken, High if a core flow is broken, Medium otherwise, Low for cosmetic issues.

---

### TASK

Use for planned work: new features, improvements, refactors, infrastructure, documentation.

**Summary format**: `[<component>] <imperative verb> <what>`
- Imperative verb: Add, Implement, Refactor, Update, Remove, Migrate, Document, Configure
- Examples:
  - `[backend] Add --reset flag to seed management command`
  - `[deploy] Migrate Helm chart values to support multi-environment secrets`
  - `[e2e] Add Cucumber scenario for group access approval flow`

**Description template**:
```
## Goal
<One or two sentences: what needs to be done and why it matters.>

## Background & context
<Why is this needed now? What triggered it?
Reference related issues, decisions, or constraints the assignee should know about.>

## Acceptance criteria
- [ ] <Specific, verifiable condition 1>
- [ ] <Specific, verifiable condition 2>
- [ ] <…>

## Technical approach (suggested)
<Concrete guidance for the assignee:
- Which files / modules to touch
- Recommended implementation pattern (reference existing code where applicable)
- Known constraints or risks
- Dependencies on other tasks or services
If speculative, mark clearly as "suggestion, not requirement.">

## Out of scope
<Explicit list of what this task does NOT cover, to prevent scope creep. Remove if not needed.>

## References
<Links to docs, related issues, ADRs, or PRs. Remove if empty.>
```

**Labels**: component label (e.g. `backend`, `frontend`) + type label: `feature`, `refactor`, `infra`, `docs`, `test`
**Priority**: High if blocking other work or sprint goal, Medium for planned work, Low for nice-to-have.

---

## Step 3 — Check for duplicates

Before creating, search for existing open issues:

```jql
project = <PROJECT_KEY> AND statusCategory != Done AND summary ~ "<3-4 key words from the summary>"
```

If a close match exists, show it to the user and ask whether to proceed with a new issue or link to the existing one.

## Step 4 — Create the issue

Use the `createJiraIssue` MCP tool with the fields built above.

## Step 5 — Confirm

After creation, show:
- Issue key and URL
- Summary
- One-line recap: type, priority, labels

## Step 6 — Save configuration (first run only)

If no `## Saved configuration` section existed at the start (Step 0), ask the user:

> "Should I remember the project key **<KEY>** for future use? I'll save it in this skill file."

If the user confirms, append the following to the end of this file:

```
## Saved configuration

project: <KEY>
```

---

<!-- ------------------------------------------------------------------ -->
<!-- Everything below this line is written automatically by the skill.   -->
<!-- Do not edit manually.                                               -->
<!-- ------------------------------------------------------------------ -->
