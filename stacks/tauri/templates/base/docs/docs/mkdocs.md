# Writing docs

This site is built with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/).

## Getting started

```bash
dude docs            # serve at http://localhost:8001 (live-reload, via Docker)
dude docs --port 9000
```

## Adding a page

1. Create `docs/docs/my-page.md`.
2. Add it to the `nav` section of `docs/mkdocs.yml`:

   ```yaml
   nav:
     - Home: index.md
     - My page: my-page.md
   ```

3. `dude docs` reloads automatically.

Code blocks, admonitions, tabs, task lists and Mermaid diagrams are enabled —
see the [Material reference](https://squidfunk.github.io/mkdocs-material/reference/)
for syntax.
