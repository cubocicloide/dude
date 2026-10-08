# @cubocicloide/stack-expo-firebase

Expo SDK 57 + Firebase stack plugin for the [dude](../../README.md) CLI.

It scaffolds a universal Android, iOS, and web application with Expo Router,
email/password Firebase Authentication, per-user Firestore notes, local Auth and
Firestore emulators, EAS build profiles, tests, docs, and structural lint rules.

```bash
dude init my-app --stack expo-firebase
cd my-app
pnpm install
dude firebase emulators
# in a second terminal
dude dev --go
```

Generated applications require Node.js 22.13 or newer. The stack plugin itself
remains compatible with the dude monorepo's Node.js 20.19 baseline.
