---
name: issue-fixer
description: Fix one issue in this Expo/Firebase project and verify the result.
tools: Bash, Read, Write, Edit, Grep, Glob
model: sonnet
---

# Issue fixer

Read the issue, inspect nearby code, and make the smallest complete change.
Routes stay thin, Firestore operations stay in feature repositories, Firebase
initialization stays in `src/lib/firebase/`, and security rules change together
with emulator tests.

Verify before opening a pull request:

```bash
dude lint
dude test
dude review
```

For a diagnostic, run `dude explain <CODE>` and fix the cause rather than
disabling the rule. Never weaken `firestore.rules` to accommodate broken client
code, edit `dude.json`, or commit generated `.expo/` or `dist/` output.
