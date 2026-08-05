---
'@cubocicloide/stack-react-django': minor
'@cubocicloide/stack-react-fastapi': minor
---

Scaffold a Stripe-style API reference at `/api/docs` in both stacks.

Swagger UI (react-django) and Swagger UI + ReDoc (react-fastapi) are replaced by a
single Scalar reference — three-pane layout, brand accent, live Test Request.

Each scaffold now ships a hand-written narrative alongside the generated schema:

- react-django — `backend/config/api_docs.py` (`API_DESCRIPTION`, `API_TAGS`), wired
  into `SPECTACULAR_SETTINGS`; the page lives at `backend/templates/api-docs.html`.
- react-fastapi — `backend/app/core/api_docs.py` (`API_DESCRIPTION`, `API_TAGS`,
  `scalar_html`), wired into the `FastAPI(...)` constructor.

Every scaffolded endpoint carries a tag, an imperative summary and a description
that says something the schema does not, so `dude api sync` and the reference both
start out complete.
