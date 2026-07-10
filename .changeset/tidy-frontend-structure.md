---
'@cubocicloide/stack-react-fastapi': major
---

Frontend structure overhaul: privileged `$`-directories, zustand, and 12 FE lint rules.

**New frontend layout (breaking for scaffolded projects).** The frontend tree is now organised in scopes with privileged `$`-prefixed folders that sort on top and can never be confused with a route segment or domain name:

- `components/` → `$components/`, `hooks/` → `$hooks/` (both nestable inside components and pages — matrioska).
- Every scope (component, hook, page, utils domain) owns the same file set: `index.tsx`, `styles.module.css`, `types.tsx`, `constants.tsx`, `functions.tsx`, plus `$assets/` (non-code files only) and `$misc/` (check-exempt escape hatch, always warned).
- `index.css` → `styles.module.css` (global selectors via `:global(...)`).
- New `$types/` folder holds every `*.d.ts` (e.g. `vite-env.d.ts`).
- `utils/` is now organised in kebab-case domains (e.g. `utils/formatters/`).
- Page route segments must be kebab-case or a dynamic `[param]` (e.g. `pages/users/[id]/`).

**Lint.** FE001–FE008 rewritten for the `$`-structure; new FE009 (utils domains), FE010 (src root layout + `$types`), FE011 ($misc warning with relocation guidance), FE012 (index.tsx hygiene: types → `types.tsx`, helpers → `functions.tsx`, extra components/hooks → `$components/`/`$hooks/`). All `.claude/rules/FE/*.md` updated in the template.

**Zustand.** Added `zustand` to the scaffold dependencies with an example store (`$hooks/useCounterStore/`, devtools middleware enabled only in dev) and a demo card on the home page.

**Postgres template.** New `/users` and `/users/[id]` pages (antd Table + Descriptions over the generated OpenAPI client), conditionally wired into `App.tsx` and the Layout sidebar (menu entries now live in `$components/Layout/constants.tsx`).

**Fixes.** Frontend `tsconfig.json` now sets `noEmit: true` — `npm run build` (`tsc -b`) used to emit stray `.js` files into `src/`. ESLint disables `react-refresh/only-export-components` under `src/utils/` (utils never export components).
