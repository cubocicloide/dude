---
"@cubocicloide/stack-react-fastapi": patch
---

`dude test`: run `playwright install` after `pnpm install` in e2e/

After auto-installing e2e node_modules, the test command now also
runs `pnpm exec playwright install` so Chromium/Firefox/WebKit
browsers are available before cucumber-js tries to launch them.
