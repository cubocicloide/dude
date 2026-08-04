---
'@cubocicloide/dude': patch
---

Complete the core command catalog: `version` and `help` were registered in
`cli.ts` but missing from `buildCoreCatalog`, so `dude help`, `dude help --format md`
and `dude help --format json` all under-reported the CLI. A command absent from the
catalog is effectively invisible to a coding agent, which has no other way to
discover it — and `help`'s absence was circular: an agent reading the JSON catalog
had no structured way to learn that `--format json` exists at all.

`help` now also declares its own arguments (`--format`, and the optional
`<group> <command>` positionals) so the catalog is self-describing. Parsing is
unchanged — `run()` still reads `process.argv` directly, because it needs the raw
tokens to tell `dude help iac deploy` from a flag; the declarations are metadata
for discovery.
