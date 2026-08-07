---
name: create-page
description: Scaffold a new frontend page (React + Ant Design) — page directory, route in App.tsx, menu entry in Layout, reusing hooks and the typed src/ipc layer. Use when asked to add a page, screen or view to the app.
---

# Create a frontend page

Add a routed page under `src/pages/`. Follow every step — `dude lint`
enforces all of them.

## 1. Ask / infer

- Page name (PascalCase, e.g. `Settings`) and route path (e.g. `/settings`).
- What it displays, and which backend commands it needs. If a command is
  missing, run /create-command first.

## 2. Survey what exists

- `src/ipc/index.ts` — the typed IPC calls available.
- `src/components/index.tsx` and `src/hooks/index.tsx` — reuse before
  creating; new shared pieces get their own dir + barrel export
  (FE001–FE003, FE006–FE007).
- An existing page (e.g. `src/pages/Home/index.tsx`) for the idioms.

## 3. Create the page (FE005)

`src/pages/<Name>/index.tsx` only (plus optional `styles.module.css`,
`types.tsx`):

- `usePageTitle('<Name>')` first.
- Ant Design components; feedback via `App.useApp().message`.
- Backend data through `@/ipc` wrappers only — never `invoke()` directly
  (FE009); event subscriptions through `useTauriEvent` only (FE010).
- Static assets go in `src/assets/` (FE008).

## 4. Wire it (FE004)

- `src/App.tsx` — import `@/pages/<Name>` and add the `<Route>`.
- `src/components/Layout/index.tsx` — add the Menu item navigating to the
  route (pick an `@ant-design/icons` icon).

## 5. Validate

```bash
dude lint && dude review
```

Use `dude lint --format json` to read the diagnostics structurally, and
`dude explain <CODE>` for the prose behind any code they report — fix the cause
the rule describes rather than working around the check.
