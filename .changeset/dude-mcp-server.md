---
'@cubocicloide/dude': minor
---

Add `dude mcp` — serve the project to a coding agent as an MCP server over stdio.

The tool list is a **projection of the resolved command catalog** (core + active
stack + project-local `.dude/commands/`), so a stack that adds a command, or a
project that drops one in `.dude/commands/`, gets a tool with no wiring. Same
introspection idea as the declined GUI, except the "UI" is the agent, so there is
nothing to maintain.

**Read-only by default.** Exposed without opting in: `dude_catalog`, `dude_lint`,
`dude_explain`, `dude_cheatsheet`, `dude_info`, `dude_version`, and
`dude_api_review` where the stack has it. Anything that starts containers,
writes, deploys or destroys is withheld — never advertised as a tool, and refused
if called anyway. Arguments that would turn a read-only tool into a writing one
are withheld too, so `dude cheatsheet --out <file>` cannot be reached through
`dude_cheatsheet`.

Opt in per project with `mcp.expose` in `dude.json`, or per run with
`--expose "test,api sync"`. `--allow-mutating` exposes the whole catalog and says
so on startup.

`dude_lint` returns the `dude lint --format json` payload as MCP
`structuredContent`, not scraped stdout — which is why this depends on that
command existing.

Each tool call spawns the same `dude` binary that is serving. The stdio transport
*is* this process's stdout, so running a command in-process would interleave its
output with protocol frames; spawning also means the tools cannot drift from the
CLI, because they are the CLI.

Adds `@modelcontextprotocol/sdk` as a runtime dependency of the CLI.
