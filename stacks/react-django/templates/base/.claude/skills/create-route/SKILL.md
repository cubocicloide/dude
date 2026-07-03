---
name: create-route
description: Scaffold a new backend API endpoint (Django REST Framework). Asks for the resource, HTTP method(s) and response shape, surveys existing apps/serializers/services for reuse, then creates or extends a Django app (model, serializer, service, view, urls, migration, tests), wires it into config/urls.py, and regenerates the typed frontend client — all enforcing the backend BE rules.
disable-model-invocation: false
allowed-tools: "Read Write Edit Glob Grep Bash(dude *) Bash(find *) Bash(cat *) Bash(grep *) Bash(ls *)"
---

# Create Route

Guided creation of a backend API endpoint that satisfies every backend rule in
`.claude/rules/BE/`. The skill **inspects the existing codebase first** so new
code reuses existing apps, serializers and services instead of duplicating them.

> Read `.claude/rules/BE/001.md`–`014.md` once at the start — they are the
> source of truth. The summary below tracks them but the rule files win.

---

## Step 0 — Locate the project

```bash
find . -maxdepth 3 -name "dude.json" | head -1
```

Set `PROJECT_ROOT` to the directory containing `dude.json`. If missing, stop
with _"No dude.json found — are you inside a dude project?"_.

---

## Step 1 — Gather requirements

Ask only for what the user hasn't already provided:

1. **Resource** — e.g. `todos`, `orders`, `users/me`.
2. **Method(s)** — list/retrieve (GET), create (POST), update (PUT/PATCH),
   destroy (DELETE). A ViewSet can expose any subset via mixins.
3. **Response shape** — fields the serializer should expose.
4. **Persistence?** — a new model, an existing model, or stateless.
5. **Permissions** — who may call it (`AllowAny`, `IsAuthenticated`, custom).

---

## Step 2 — Survey the existing code (reuse before create)

Run these and **read the relevant matches** before proposing anything:

```bash
ls "$PROJECT_ROOT"/backend/apps/
ls "$PROJECT_ROOT"/backend/apps/*/models.py "$PROJECT_ROOT"/backend/apps/*/serializers.py 2>/dev/null
grep -n include "$PROJECT_ROOT"/backend/config/urls.py
```

- **Existing app** — if the resource belongs to an existing domain (e.g. a
  `users` sub-resource), extend that app instead of creating a new one.
- **Existing serializer/model** — reuse before creating; add fields to the
  explicit `fields` tuple (BE002) rather than cloning serializers.
- **Existing service** — writes live in `services.py` (BE005); add a function
  to the existing module when the domain matches.

Report what you found and what you intend to reuse.

---

## Step 3 — Plan the file set (confirm before writing)

A **new app** touches all of these; extending an existing app touches a subset.

| File | Rule | Purpose |
|------|------|---------|
| `apps/<app>/apps.py` | BE001 | AppConfig (`name = "apps.<app>"`) |
| `config/settings/base.py` | BE001 | add `"apps.<app>"` to `LOCAL_APPS` |
| `apps/<app>/models.py` | BE009, BE010, BE011 | model with `__str__` + `Meta.ordering`; no `null=True` on text fields; `related_name` on relations |
| `apps/<app>/migrations/0001_….py` | BE006 | generated with `dude db makemigration --app <app>` and committed |
| `apps/<app>/serializers.py` | BE002 | explicit `fields` tuple — never `"__all__"` |
| `apps/<app>/services.py` | BE005 | all ORM writes (create/update/delete) |
| `apps/<app>/views.py` | BE003, BE013 | ViewSet/APIView with explicit `permission_classes` and `serializer_class` (or `@extend_schema`) |
| `apps/<app>/urls.py` | BE008 | `app_name = "<app>"` + DRF router |
| `config/urls.py` | BE008 | `path("api/", include("apps.<app>.urls"))` |
| `apps/<app>/admin.py` | — | register the model |
| `apps/<app>/tests/test_*.py` | BE014 | model + view tests (pytest-django, `APIClient`) |

Skip rows that don't apply. Present the list, then wait for an OK.

---

## Step 4 — Implement

Follow the existing patterns exactly — `apps/users/` is the reference app.
Reference shapes:

```python
# apps/todos/views.py — reads via the queryset, writes via services (BE005)
class TodoViewSet(CreateModelMixin, ListModelMixin, RetrieveModelMixin, GenericViewSet):
    """List, retrieve and create todos."""

    queryset = Todo.objects.all()
    serializer_class = TodoSerializer          # BE013
    permission_classes = [IsAuthenticated]     # BE003 — always explicit
```

```python
# apps/todos/serializers.py — explicit fields (BE002); create delegates to the service
class TodoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Todo
        fields = ("id", "title", "done", "created_at")
        read_only_fields = ("id", "created_at")

    def create(self, validated_data: dict) -> Todo:
        return create_todo(**validated_data)
```

Constraints to honour while writing:
- No raw SQL anywhere (BE004); no `print()` — use `logging` (BE012).
- Settings values come from `environ` — never hard-code secrets (BE007).
- drf-spectacular: custom actions/`APIView`s get `@extend_schema` so the
  OpenAPI schema stays typed (BE013).
- Write meaningful tests (don't just assert 200) mirroring
  `apps/users/tests/test_views.py` style.

---

## Step 5 — Migrate + validate

```bash
cd "$PROJECT_ROOT"
dude db makemigration --app <app>   # generate the migration (BE006) — commit it
dude db migrate                     # apply locally
dude lint                           # must pass — fix any BE rule violations
dude api sync                       # regenerate frontend/src/openapi/ from /api/schema/
dude test --backend                 # run the new tests
```

If `dude lint` reports a violation, fix it and re-run before continuing. After
`dude api sync` the new endpoint is available to the frontend as
`@/openapi/api/<resource>` (`$get`, `$post`, …).

---

## Step 6 — Report

```
Route created
═════════════════════════════════════════
Endpoint    <METHOD> /api/<resource>/
App         backend/apps/<app>/ (created | extended)
Registered  LOCAL_APPS + config/urls.py
Model       <created | reused | n/a>  (+ migration committed)
Serializer  <created | reused>
Service     <created | extended | n/a>
Tests       apps/<app>/tests/test_views.py (+ test_models.py)
─────────────────────────────────────────
dude lint:      ✓
dude api sync:  ✓ → @/openapi/api/<resource>
Next: wire it into a page with /create-page
```
