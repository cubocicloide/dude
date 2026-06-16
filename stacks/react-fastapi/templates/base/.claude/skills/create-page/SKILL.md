---
name: create-page
description: Scaffold a new frontend page (React + Vite + Ant Design). Asks for the route path and what the page should display, surveys existing shared components/hooks and the generated API client for reuse, then creates the page directory, wires the route into App.tsx, and adds any new components/hooks following the frontend FE rules.
disable-model-invocation: false
allowed-tools: "Read Write Edit Glob Grep Bash(dude *) Bash(find *) Bash(cat *) Bash(grep *) Bash(ls *)"
---

# Create Page

Guided creation of a frontend screen that satisfies every frontend rule in
`.claude/rules/FE/`. The skill **surveys the existing component library, hooks
and API client first** so the page composes what's already there instead of
re-inventing it.

> Read `.claude/rules/FE/001.md`–`008.md` once at the start — they are the
> source of truth. The stack uses **React 19 + Vite + TypeScript (strict)**,
> **Ant Design** (`antd`) for UI, **@tanstack/react-query** for data, and
> **react-router-dom** for routing.

---

## Step 0 — Locate the project

```bash
find . -maxdepth 3 -name "dude.json" | head -1
```

Set `PROJECT_ROOT` to the directory containing `dude.json`. If missing, stop
with _"No dude.json found — are you inside a dude project?"_.

---

## Step 1 — Gather requirements

Ask only for what the user hasn't provided:

1. **Route path** — e.g. `/todos`, `/settings`. This becomes both the
   `pages/<name>/` directory and the `<Route path>` in `App.tsx`.
2. **Page title** — shown in the header / browser tab (`usePageTitle`).
3. **What it should display** — the content and interactions: a table, a form, a
   dashboard of cards, a detail view, etc.
4. **Data source** — which API endpoint(s) feed it (if any).

---

## Step 2 — Survey the existing code (reuse before create)

Run these and **read the relevant matches** before proposing anything:

```bash
# Shared components available for reuse + their barrel
ls "$PROJECT_ROOT"/frontend/src/components
cat "$PROJECT_ROOT"/frontend/src/components/index.tsx 2>/dev/null
# Reusable hooks (e.g. usePageTitle) + barrel
ls "$PROJECT_ROOT"/frontend/src/hooks
cat "$PROJECT_ROOT"/frontend/src/hooks/index.tsx 2>/dev/null
# Existing pages — mirror their structure/style
ls "$PROJECT_ROOT"/frontend/src/pages
# Generated API client — what data is available
ls "$PROJECT_ROOT"/frontend/src/openapi/api 2>/dev/null
```

Then propose, explicitly:
- **Shared components to reuse** from `@/components` (import via the barrel:
  `import { UserCard } from '@/components'`).
- **Hooks to reuse** — always wire `usePageTitle(<title>)`; reuse any `use*`
  hook that already fetches the data you need.
- **API calls** — use the generated client: `import { $get } from '@/openapi/api/<resource>'`
  inside a `useQuery`. If the endpoint doesn't exist yet, tell the user to create
  it first with `/create-route` (then `dude api sync`).
- **Sub-components to introduce** — if the page has distinct reusable chunks,
  plan them as either page-local `components/` (used only here) or shared
  `@/components` (used elsewhere too).

---

## Step 3 — Plan the file set (confirm before writing)

Present files to **create** and **modify**, then wait for an OK.

| File | Rule | Purpose |
|------|------|---------|
| `pages/<name>/index.tsx` | FE004, FE005 | the page component (mandatory) |
| `pages/<name>/styles.module.css` | FE005 | optional scoped styles |
| `pages/<name>/types.tsx` | FE005 | optional local types |
| `pages/<name>/components/<Comp>/index.tsx` | FE001, FE002 | optional page-local sub-components (+ barrel `components/index.tsx`, FE003) |
| `src/App.tsx` | FE004 | add `import X from '@/pages/<name>'` **and** a `<Route path="<path>" element={<X />} />` |
| `src/components/<Comp>/` + barrel | FE001–003 | only when introducing a **shared** component |
| `src/hooks/use<Name>/` + barrel | FE006, FE007 | only when introducing a **shared** hook |
| `src/assets/...` | FE008 | any new static asset (never inside a component/page folder) |

Allowed contents reminders:
- A **page dir** may contain only `index.tsx` (required), `styles.module.css`,
  `types.tsx`, and subdirectories (FE005). No `utils.ts` — shared helpers go in
  `frontend/src/utils/`.
- A **component dir** may contain only `index.tsx` (required),
  `styles.module.css`, `types.tsx`, and a nested `components/` (FE002), is
  PascalCase (FE001), and must be re-exported from its parent `components/index.tsx`
  barrel in alphabetical order (FE003).
- A **hook dir** matches `use[A-Z]...`, holds only `index.tsx` (+ optional
  `types.tsx`), and is re-exported from `hooks/index.tsx` (FE006/FE007).

---

## Step 4 — Implement

Mirror `pages/index.tsx` and `components/Layout/index.tsx` for style. Reference
shape:

```tsx
// pages/todos/index.tsx
import { useQuery } from '@tanstack/react-query'
import { Card, Space, Table, Typography } from 'antd'
import { $get as getTodos } from '@/openapi/api/todos'
import usePageTitle from '@/hooks/usePageTitle'

const { Title } = Typography

export default function TodosPage() {
  usePageTitle('Todos')
  const { data, isLoading } = useQuery({ queryKey: ['todos'], queryFn: getTodos })

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Title level={2}>Todos</Title>
      <Card>
        <Table loading={isLoading} dataSource={data ?? []} rowKey="id" columns={[/* … */]} />
      </Card>
    </Space>
  )
}
```

```tsx
// App.tsx — add inside the <Layout> route (FE004), keep imports tidy
import TodosPage from '@/pages/todos'
...
<Route element={<Layout />}>
  <Route path="/" element={<HomePage />} />
  <Route path="/todos" element={<TodosPage />} />
</Route>
```

If the page should appear in the sidebar, add a matching item to the `Menu` in
`components/Layout/index.tsx` (key = first path segment, with an `@ant-design/icons` icon).

Constraints to honour while writing:
- Use `antd` components and `@ant-design/icons` — match the existing visual
  language; avoid bespoke CSS when an antd component exists.
- Fetch through `@tanstack/react-query` + the generated `@/openapi` client; never
  hand-write `fetch` calls or edit `frontend/src/openapi/` by hand.
- Imports use the `@/` alias (FE008 for assets too).
- Adding a component → update its barrel; adding a hook → update `hooks/index.tsx`
  in the same change (FE003/FE007).

---

## Step 5 — Validate

```bash
cd "$PROJECT_ROOT"
dude lint     # must pass — enforces FE directory/barrel/route rules
```

Fix any reported violation and re-run before continuing. If the dev server is
running (`dude up`), Vite HMR will show the page immediately at the route path.

---

## Step 6 — Report

```
Page created
═════════════════════════════════════════
Route       <path>  →  pages/<name>/index.tsx
Wired in    App.tsx (<Route>) [+ Layout menu item]
Reused      components: <…>   hooks: <…>   api: <…>
New shared  components: <…>   hooks: <…>
Assets      <…|none>
─────────────────────────────────────────
dude lint:  ✓
Open: http://localhost:5173<path>
```
