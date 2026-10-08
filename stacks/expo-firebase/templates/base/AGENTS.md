# AGENTS.md

Start by running `dude cheatsheet --format json`. It returns this project's live
command catalog, lint rules, verify loop, stack version, and init answers.

Read [CLAUDE.md](CLAUDE.md) and the matching `.claude/rules/<GROUP>/<NNN>.md`
before changing a structure guarded by `dude lint`.

Before reporting work complete, run:

```bash
dude lint
dude test
dude review
```
