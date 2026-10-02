---
name: create-screen
description: Add a typed Expo Router route backed by a feature screen.
disable-model-invocation: false
allowed-tools: 'Read Glob Grep Write Edit Bash(dude *)'
---

# Create an Expo screen

Inspect `app/` and the closest feature. Put product UI in
`src/features/<feature>/<Name>Screen.tsx`; the matching `app/` route should only
import and render it. Reusable UI goes in `src/components/<Name>/index.tsx` and
shared hooks in `src/hooks/use<Name>/index.ts`. Do not import Firebase from the
route. Verify with `dude lint --format json`, use `dude explain <CODE>` for any
failure, then run `dude test` and `dude review`.
