---
paths:
  - "stacks/**/template*/**"
---

# Template overlay system

## Overlays

Files are copied in this order; later overlays win on conflict:

1. `template/` — base files, always applied
2. `template-postgres/` — applied when `--database postgres`
3. `template-celery/` — applied when `--celery`
4. `template-celerybeat/` — applied when `--celerybeat` (implies `--celery`)

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

- **Always present**: add to `template/`.
- **Postgres-only**: add to `template-postgres/`.
- **Celery-only**: add to `template-celery/`.
- **CeleryBeat-only**: add to `template-celerybeat/`.
- **Optional content within a file**: use `{{#if withPostgres}}…{{/if}}` inside
  an `.hbs` file in `template/`.

## Testing changes

After modifying any template file, always verify with the dev scaffold loop:

```bash
make dev-init                               # base scaffold
make dev-init STACK_OPTS="--database postgres --celery --celerybeat"  # full scaffold
cd private/examples/test-local && dude lint
```
