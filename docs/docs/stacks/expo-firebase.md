<!-- GENERATED FILE — do not edit.
     Produced by scripts/compose-docs.mjs from each stack's `docs` manifest.
     Change the manifest in stacks/<id>/src/index.ts, then run `make docs-data`.
     docs/docs/stacks/expo-firebase.md -->

# `expo-firebase`

A universal Expo app for Android, iOS and web with Firebase Auth and Firestore.

**Built with:** `Expo SDK 57` · `React Native 0.86` · `Expo Router` · `Firebase 12`

---

## Scaffold it

```bash
dude init my-app --stack expo-firebase
```

The questions `dude init` asks for this stack — pass the matching flag to
answer it non-interactively. Flag names ignore case and dashes, so
`--celery-beat`, `--celeryBeat` and `--celerybeat` are the same flag.

| Question | Flag | Default |
| -------- | ---- | ------- |
| Project name | `--project-name <value>` | `my-app` |

## What it is for

- A universal Android, iOS and web product built from one React Native codebase
- An Expo Go-friendly app with Firebase email/password authentication and Firestore
- A mobile team that wants local Firebase emulators and EAS build profiles from day one

## Conventions it enforces

`dude lint` runs **10 structural checks** for this stack, grouped by
area. Each one ships a prose rule file in the generated project under
`.claude/rules/`, so both you and a coding agent can see why a check exists
and how to fix a violation.

| Group | Checks |
| ----- | ------ |
| `FB` | 4 |
| `RN` | 6 |

## Documentation inside the project

Every scaffolded project gets its own documentation site, served with
`dude docs`. This stack ships:

| Page | Title | Included |
| ---- | ----- | -------- |
| `index.md` | Home | always |
| `architecture.md` | Architecture | always |
| `firebase.md` | Firebase setup | always |
| `emulators.md` | Local emulators | always |
| `testing.md` | Testing | always |
| `builds.md` | EAS builds | always |
| `dude.md` | Working with dude | always |
| `api.md` | Command reference | always |
| `cheatsheet.md` | Cheatsheet | always |
| `mkdocs.md` | Writing docs | always |

## Versions

- **Package:** [`@cubocicloide/stack-expo-firebase`](https://www.npmjs.com/package/@cubocicloide/stack-expo-firebase)
- **Requires dude:** `>= 0.17.2`

Both the CLI and the stack are pinned per project, so different projects can
sit on different versions. See [How it works](../concepts.md).
