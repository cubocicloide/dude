---
"@cubocicloide/stack-react-fastapi": patch
---

`dude test`: auto-install e2e node_modules when missing

Before running `pnpm run test` in `e2e/`, the test command now checks
whether `node_modules/` exists and runs `pnpm install` automatically
if it does not. This fixes the `cucumber-js: command not found` error
on first run.
