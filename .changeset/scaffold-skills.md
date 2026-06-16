---
"@cubocicloide/stack-react-fastapi": minor
---

Add guided scaffolding skills to the generated `.claude/skills/`.

Scaffolded projects now ship three Claude skills that scaffold new code while
enforcing the stack's structural rules and reusing existing code:

- `/create` — router skill: asks whether you want a backend route or a frontend
  page, then runs the matching flow.
- `/create-route` — asks for the path, method(s) and response shape, surveys
  existing schemas/queries/routers for reuse, creates the router and registers
  it in `main.py`, adds any model/query/schema, writes the 1-to-1 tests, and
  regenerates the typed frontend client. Enforces the `BE` rules.
- `/create-page` — asks for the route path and what to display, surveys the
  shared component library, hooks and generated API client for reuse, creates
  the page directory, wires the route into `App.tsx`, and adds any new
  components/hooks. Enforces the `FE` rules.
