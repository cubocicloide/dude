---
"@cubocicloide/stack-react-fastapi": patch
---

Fix the getting-started documentation in generated projects.

- Correct the global install: it's `@cubocicloide/dude-launcher` (not `@cubocicloide/dude`).
- Document the private GitHub Packages registry auth (`~/.npmrc` + `GITHUB_TOKEN`).
- Add the correct lifecycle order: launcher → `dude init` → `pnpm install` → `dude up --build`.
- Note for users who cloned an existing project to skip `dude init` and start at `pnpm install`.
- Add a documentation-site section (`dude docs`) to the README.
- `docs/index.md` now has a full Getting started block and links to `api.md` / `deploy.md`.
