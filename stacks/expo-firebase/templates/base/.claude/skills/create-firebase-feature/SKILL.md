---
name: create-firebase-feature
description: Add a user-scoped Firestore feature with repository, rules, tests, and UI.
disable-model-invocation: false
allowed-tools: 'Read Glob Grep Write Edit Bash(dude *)'
---

# Create a Firebase feature

Create `src/features/<feature>/types.ts`, `repository.ts`, and the feature UI.
All Firestore imports belong in `repository.ts`; take the authenticated uid as
an explicit argument and store user-owned documents below `users/{uid}`. Extend
`firestore.rules` with least privilege and add allow/deny cases to the emulator
test. Never add an unconditional allow rule. Verify with:

```bash
dude lint --format json
dude test --emulator
dude review
```

Use `dude explain <CODE>` when structural lint reports a violation.
