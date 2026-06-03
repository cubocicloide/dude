# Skill: add-template-file

Use this skill when asked to add a new file (or conditional content) to the
`react-fastapi` scaffold.

---

## Decision tree — which overlay?

| When should the file appear? | Target directory |
|------------------------------|-----------------|
| Always | `stacks/react-fastapi/template/` |
| Only when Postgres is enabled | `stacks/react-fastapi/template-postgres/` |
| Only when Celery is enabled | `stacks/react-fastapi/template-celery/` |
| Only when CeleryBeat is enabled | `stacks/react-fastapi/template-celerybeat/` |
| Conditional content inside an existing file | Use `{{#if withPostgres}}…{{/if}}` inside an `.hbs` file in `template/` |

## Handlebars variables

```
projectName   — string
withPostgres  — boolean
withCelery    — boolean
withCeleryBeat — boolean
withRedis     — boolean
```

## File naming

- Use `.hbs` extension when the file needs variable substitution.
- Name `_gitignore` (with underscore) for `.gitignore` files — the scaffolder renames it.

## Python `__init__.py` files

Every new Python package directory needs an `__init__.py`.
If the directory should appear in the base scaffold, add both:
- `template/backend/app/<dir>/__init__.py`
- `template/backend/app/tests/<dir>/__init__.py`

## After adding the file

1. Rebuild: `pnpm --filter @cubocicloide/stack-react-fastapi build`
2. Scaffold: `make dev-init` (and with all options if applicable)
3. Verify: `cd private/examples/test-local && dude lint`
4. Check the new file is present in the scaffolded output.

## Update documentation

If the new file is part of the required backend structure, also update:
- `template/.claude/rules/BE/001.md` — add to the directory tree
- `stacks/react-fastapi/template/backend/README.md.hbs` — mention the new directory if user-facing
