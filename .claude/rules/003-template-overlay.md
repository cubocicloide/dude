---
paths:
  - "stacks/**/templates/**"
---

# Template overlay system

## Overlays

Files are copied in this order; later overlays win on conflict:

Overlays live under `stacks/<stack>/templates/`:

1. `templates/base/` — base files, always applied
2. `templates/postgres/` — applied when `--database postgres`
3. `templates/celery/` — applied when `--celery`
4. `templates/celerybeat/` — applied when `--celerybeat` (implies `--celery`)

## Handlebars context variables

Every `.hbs` file has access to:

| Variable         | Type    | Description                                 |
| ---------------- | ------- | ------------------------------------------- |
| `projectName`    | string  | The name passed to `dude init`              |
| `withPostgres`   | boolean | `true` when `--database postgres`           |
| `withCelery`     | boolean | `true` when `--celery` or `--celerybeat`    |
| `withCeleryBeat` | boolean | `true` when `--celerybeat`                  |
| `withRedis`      | boolean | `true` when Celery or CeleryBeat is enabled |

Use `{{#if withPostgres}}…{{/if}}` to guard conditional blocks.

## File naming

- Plain files are copied verbatim (e.g. `tsconfig.json`).
- Files ending in `.hbs` are processed with Handlebars; the `.hbs` suffix is
  stripped (e.g. `README.md.hbs` → `README.md`).
- Files named `_gitignore` are renamed to `.gitignore` during scaffolding.

## Adding a new file

- **Always present**: add to `templates/base/`.
- **Postgres-only**: add to `templates/postgres/`.
- **Celery-only**: add to `templates/celery/`.
- **CeleryBeat-only**: add to `templates/celerybeat/`.
- **Optional content within a file**: use `{{#if withPostgres}}…{{/if}}` inside
  an `.hbs` file in `templates/base/`.

## Testing changes

After modifying any template file, always verify with the dev scaffold loop:

```bash
make dev-init                               # base scaffold
make dev-init STACK_OPTS="--database postgres --celery --celerybeat"  # full scaffold
cd private/examples/test-local && dude lint
```
