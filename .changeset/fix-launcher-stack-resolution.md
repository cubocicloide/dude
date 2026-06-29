---
"@cubocicloide/dude": patch
---

fix(stack-loader): improve error message when stack dist is missing in source checkout

When the globally installed `dude-launcher` is used from within a monorepo
source checkout and the stack package has not been compiled, the CLI now emits
a context-sensitive error that explains the situation and provides the exact
build command needed (`pnpm --filter <pkg> build` / `make build`).

The `resolveStackRoot` function now tracks *how* a stack root was found
(Node resolution, pnpm-workspace scan, dude cache, or explicit path) and
`loadStack` uses that information to tailor the remediation message — distinct
guidance for workspace checkouts, installed packages, cache entries, and
explicit paths.

A new test file (`stack-loader.test.ts`) covers the missing-dist error paths
for each resolution source and verifies that a properly built stack loads
successfully.
