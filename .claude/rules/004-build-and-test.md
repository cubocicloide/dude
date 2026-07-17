---
paths:
  - "**"
---

# Build and scaffold-test workflow

## After any source change

```bash
# Rebuild the affected package
pnpm --filter @cubocicloide/stack-react-fastapi build   # stack changes
pnpm --filter @cubocicloide/dude build                  # CLI changes

# Or rebuild everything
make build
```

Never test against a stale `dist/`. Always rebuild first.

## After any template or lint-check change

```bash
# 1. Rebuild the stack
pnpm --filter @cubocicloide/stack-react-fastapi build

# 2. Scaffold a fresh test project
make dev-init

# 3. Validate
cd private/examples/test-local
dude lint           # must exit 0 with no errors

# 4. Optionally test with all options enabled
cd /path/to/dude
make dev-init STACK_OPTS="--database postgres --celery --celerybeat"
cd private/examples/test-local
dude lint
```

## CI equivalents

All of the above is what CI runs. If `dude lint` passes locally it should pass
in CI. If it fails only in CI, check:

- The stack was rebuilt before scaffolding (`make build` in CI).
- Node version matches (`.nvmrc` or `engines` field in `package.json`).

## Checking TypeScript errors

```bash
make typecheck    # tsc --noEmit across the workspace
make lint         # ESLint across the workspace
```

Run these before opening a PR.
