---
paths:
  - "frontend/src/components/**"
---

# Frontend Component Conventions (FE001–FE003)

These rules are enforced by `dude lint` (codes FE001–FE003). Violations block CI.

---

## FE001 — Component directory naming

Every direct child of any `components/` folder must be **PascalCase**: `^[A-Z][a-zA-Z0-9]+$`.

| Valid | Invalid |
|-------|---------|
| `UserCard/` | `userCard/` |
| `TodoTable/` | `todo-table/` |
| `AsyncSelect/` | `async_select/` |

---

## FE002 — Allowed files inside a component directory

A component directory may contain **only**:

| Item | Required? |
|------|-----------|
| `index.tsx` | **Mandatory** — exports the component as default |
| `styles.module.css` | Optional — CSS module |
| `types.tsx` | Optional — type declarations |
| `components/` | Optional — sub-components (same rules apply recursively) |

Any other file or subdirectory is an error. Put shared helpers in a parent `utils/` directory or hoist them up.

```
# Correct
UserCard/
  index.tsx
  styles.module.css
  components/
    Avatar/
      index.tsx

# Wrong
UserCard/
  index.tsx
  utils.ts          ← FE002 error
  UserCard.test.ts  ← FE002 error
  helpers/          ← FE002 error (not named components/)
```

---

## FE003 — Components barrel file

Every `components/` folder must have an `index.tsx` that re-exports all PascalCase child directories.

Required export form (exact format):
```tsx
export { default as UserCard } from "./UserCard";
export { default as TodoTable } from "./TodoTable";
```

Rules:
- No named re-exports, no `export *`, no JSX, no imports.
- Entries must be kept in the same order as on disk (alphabetical).
- **Adding a new component = add its export to the barrel in the same PR.**

The barrel may also contain blank lines and single-line `//` comments.
