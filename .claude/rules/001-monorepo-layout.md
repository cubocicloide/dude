---
paths:
  - "**"
---

# Monorepo layout and naming conventions

## Package names

| Directory                 | npm name                            | Role        |
| ------------------------- | ----------------------------------- | ----------- |
| `packages/dude/`          | `@cubocicloide/dude`                | CLI runtime |
| `packages/dude-launcher/` | `@cubocicloide/dude-launcher`       | Global shim |
| `stacks/react-fastapi/`   | `@cubocicloide/stack-react-fastapi` | Stack plugin|
| `stacks/fastmcp/`         | `@cubocicloide/stack-fastmcp`       | Stack plugin|
| `stacks/tauri/`           | `@cubocicloide/stack-tauri`         | Stack plugin|

## Adding a new stack

1. Create `stacks/<stack-name>/` mirroring the `react-fastapi` structure.
2. Register it in `packages/dude/registry.json` (name → npm package mapping).
3. Export the stack contract from `stacks/<stack-name>/src/index.ts`.
4. The `stacks/*` glob in `pnpm-workspace.yaml` picks it up automatically.
5. Add a build entry in `turbo.json` if non-standard.

## Directory rules

- Source lives in `src/`; compiled output lives in `dist/` — never edit `dist/`.
- Templates live under `templates/` as overlays: `base/`, `postgres/`, `celery/`, `celerybeat/`.
- Test scaffolds land in `private/examples/` — this path is gitignored.
- Changesets live in `.changeset/` — commit them alongside the source change.

## TypeScript conventions

- ESM only (`"type": "module"` in all `package.json`).
- `tsconfig.base.json` at root; each package extends it.
- Strict mode enabled.
