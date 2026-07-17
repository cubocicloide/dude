---
'@cubocicloide/dude': minor
---

Add a core `dude report` command that files a bug report about **dude itself** (the CLI or a stack) against the dude repository, with `dude info` diagnostics attached automatically. It creates the issue directly via `gh` when authenticated, or opens a pre-filled browser issue form otherwise (`--web` forces the browser; `--print` assembles the report and touches nothing). The target repo, issue-form field mapping, and diagnostics live in versioned CLI code — not a shipped skill or project file — so the reporting channel stays correct across every stack and cannot drift or be accidentally edited. Field flags (`--title`, `--command`, `--expected`, `--actual`, `--repro`, `--context`) make it drivable from an editor assistant. The shared diagnostics logic behind `dude info` and `dude report` was factored into `core/diagnostics.ts` so the two can never diverge.
