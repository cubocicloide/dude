# Cheatsheet

!!! info "Auto-generated"
    This page is generated from **this project** every time you run `dude docs`:
    the commands it actually has, the conventions `dude lint` enforces, the verify
    loop, and how it was scaffolded. So it always matches your init choices
    (database, Celery, IaC…) and any project-local commands under
    `.dude/commands/`.

    You're seeing this placeholder because the docs haven't been served yet. Run:

    ```bash
    dude docs
    ```

    and this page will be replaced with the real cheatsheet. You can also print it
    yourself at any time:

    ```bash
    dude cheatsheet                  # this page, as Markdown
    dude cheatsheet --format json    # the same data for tooling and coding agents
    dude cheatsheet --out NOTES.md   # write it somewhere instead of stdout
    ```

!!! tip "Working with a coding agent?"
    Point it at `dude cheatsheet --format json`. One call returns the command
    catalog, every lint rule with its code, and the verify loop — so it knows what
    it may run and what will be checked, without crawling this whole site.
