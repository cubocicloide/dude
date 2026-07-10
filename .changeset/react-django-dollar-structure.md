---
'@cubocicloide/stack-react-django': major
---

Frontend structure overhaul: privileged `$`-directories, zustand, favicon, and 12 FE lint rules — the same refactor already shipped for `react-fastapi`, adapted for Django.

**New frontend layout (breaking for scaffolded projects).** The frontend tree is now organised in scopes with privileged `$`-prefixed folders that sort on top and can never be confused with a route segment or domain name:

- `components/` → `$components/`, `hooks/` → `$hooks/` (both nestable inside components and pages — matrioska).
- Every scope (component, hook, page, utils domain) owns the same file set: `index.tsx`, `styles.module.css`, `types.tsx`, `constants.tsx`, `functions.tsx`, plus `$assets/` (non-code files only) and `$misc/` (check-exempt escape hatch, always warned).
- `index.css` → `styles.module.css` (global selectors via `:global(...)`).
- New `$types/` folder holds every `*.d.ts` (e.g. `vite-env.d.ts`).
- `utils/` is now organised in kebab-case domains (e.g. `utils/formatters/`).
- Page route segments must be kebab-case or a dynamic `[param]` (e.g. `pages/users/[id]/`).

**Lint.** FE001–FE008 rewritten for the `$`-structure (FE002/FE005/FE006/FE009/FE010 report unexpected files/directories as errors); new FE009 (utils domains), FE010 (src root layout + `$types`), FE011 (`$misc` warning with relocation guidance), FE012 (`index.tsx` hygiene). All `.claude/rules/FE/*.md` updated in the template.

**Zustand.** Added `zustand` to the scaffold dependencies with an example store (`$hooks/useCounterStore/`, devtools middleware enabled only in dev) and a demo card on the home page.

**Users pages.** New `/users` and `/users/[id]` pages (antd Table + Descriptions over the generated OpenAPI client), wired into `App.tsx` and the Layout sidebar. Unlike `react-fastapi`, the users API is part of Django's always-present `auth` app, so the pages live in the **base** overlay (not postgres-gated) and consume DRF's **paginated** list response (`results`) and the Django `User` shape (`username`, `first_name`, `last_name`, `date_joined`).

**Fixes carried over.** Frontend `tsconfig.json` now sets `noEmit: true` (avoids stray `.js` from `tsc -b`); ESLint disables `react-refresh/only-export-components` under `src/utils/`; added a default `frontend/public/favicon.svg`.
