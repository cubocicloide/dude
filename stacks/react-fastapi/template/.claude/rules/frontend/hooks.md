---
paths:
  - "frontend/src/hooks/**"
---

# Frontend Hook Conventions (FE006–FE007)

These rules are enforced by `dude lint` (codes FE006–FE007). Violations block CI.

---

## FE006 — Hook directory naming and contents

Hook directories must match `^use[A-Z][a-zA-Z0-9]*$`.

| Valid | Invalid |
|-------|---------|
| `useAttachments/` | `useattachments/` |
| `useTodoList/` | `todo-list/` |
| `useAuth/` | `Auth/` |

A hook directory may contain **only**:

| Item | Required? |
|------|-----------|
| `index.tsx` | **Mandatory** — exports the hook as default |
| `types.tsx` | Optional |

No subdirectories, no other files. If the hook needs helpers, inline them in `index.tsx` or move shared logic to `frontend/src/utils/`.

---

## FE007 — Hooks barrel file

`frontend/src/hooks/index.tsx` must re-export every `use*` directory. Required format:

```tsx
export { default as useAttachments } from "./useAttachments";
export { default as useTodoList } from "./useTodoList";
```

- The alias name must exactly match the directory name.
- **Adding a new hook = update the barrel in the same PR.**
- No named re-exports, no `export *`, no JSX.
