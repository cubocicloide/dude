---
paths:
  - "frontend/src/pages/**"
  - "frontend/src/App.tsx"
---

# Frontend Page Conventions (FE004–FE005)

These rules are enforced by `dude lint` (codes FE004–FE005). Violations block CI.

---

## FE004 — Route ↔ directory 1-to-1 correspondence

Every import in `App.tsx` that references `@/pages/<name>` must have a matching directory `frontend/src/pages/<name>/`, and every such directory must be imported in `App.tsx`.

- **Error**: `App.tsx` imports a page that does not exist on disk.
- **Warning**: a `pages/<name>/` directory exists but is not imported in `App.tsx`.

**When adding a new page:**
1. Create `frontend/src/pages/<name>/index.tsx`
2. Add the import and `<Route>` in `App.tsx` in the same PR

Namespace directories (e.g. `pages/admin/`) without their own `index.tsx` are allowed only if they contain nested page directories.

---

## FE005 — Allowed files inside a page directory

A page directory may contain **only**:

| Item | Required? |
|------|-----------|
| `index.tsx` | **Mandatory** |
| `styles.module.css` | Optional |
| `types.tsx` | Optional |
| Subdirectories | Optional (nested routes or local `components/`) |

No arbitrary files (`utils.ts`, `helpers.ts`, etc.). Shared utilities belong in `frontend/src/utils/`.
