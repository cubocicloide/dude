---
name: create
description: Route creation work to the Expo screen or Firebase feature workflow.
disable-model-invocation: false
allowed-tools: 'Read Glob Grep Bash(dude *)'
---

# Create

Choose the matching workflow:

- A route or UI screen: read `.claude/skills/create-screen/SKILL.md`.
- A Firestore-backed domain: read `.claude/skills/create-firebase-feature/SKILL.md`.

When a feature needs both, create the repository and types first, then the thin
route and feature screen. Finish with `dude lint`, `dude test`, and `dude review`.
