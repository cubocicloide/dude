# Skill: create-github-issue

Use this skill when asked to open a GitHub issue on the `dude` repository.

---

## Step 1 — Collect issue details

Ask (or infer from context):

| Field | Notes |
|-------|-------|
| **Title** | Concise, imperative: "Add X", "Fix Y in Z" |
| **Type** | `bug`, `enhancement`, `chore`, `docs` |
| **Description** | What / why / acceptance criteria |
| **Labels** | Map type → label (see below) |
| **Milestone** | Optional — only if the work targets a specific release |

Label mapping:

| Type | Labels |
|------|--------|
| `bug` | `bug` |
| `enhancement` | `enhancement` |
| `chore` | `chore` |
| `docs` | `documentation` |

---

## Step 2 — Open the issue via GitHub MCP

```
mcp: github_repo → create issue
  title: "<title>"
  body:  "<description with ## What, ## Why, ## Acceptance criteria>"
  labels: ["<label>"]
```

---

## Step 3 — Confirm and share the link

Report back:
- Issue number and URL
- Assigned labels
- Any follow-up actions (e.g. link to a branch or PR if work starts immediately)
