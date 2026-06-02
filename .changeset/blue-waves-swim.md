---
"@cubocicloide/dude": minor
---

feat: auto-install stack on demand — when a stack package is not installed locally, dude installs it into `~/.dude/cache/stacks/` using npm and the user's `~/.npmrc` auth; cached by name+version so subsequent runs are instant
