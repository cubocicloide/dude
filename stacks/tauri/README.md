# @cubocicloide/stack-tauri

Tauri 2 desktop app stack plugin for the [dude](https://github.com/cubocicloide/dude) CLI.

Scaffolds a cross-platform desktop application:

- **Frontend** — React 19 + Vite + TypeScript (strict) + Ant Design, with a
  typed IPC layer (`src/ipc/`) wrapping every Tauri command.
- **Backend** — Rust (Tauri 2): commands, managed state, events, a shared
  `AppError` type, and the log + opener plugins wired in.
- **Optional SQLite** — `dude init --database sqlite` adds a `rusqlite`-backed
  notes domain (Rust commands + Ant Design page) demonstrating persistent
  storage in the app data directory.

Commands: `dude dev`, `dude build`, `dude doctor`, `dude icon`, `dude lint`,
`dude format`, `dude review`, `dude test`, `dude docs`.

`dude lint` enforces the stack's structural conventions: 11 frontend checks
(FE001–FE011) and 11 Rust/Tauri checks (BE001–BE011), each documented in the
generated project's `.claude/rules/` directory.

## Usage

```bash
dude init --stack tauri my-app
cd my-app
pnpm install
dude doctor   # verify Rust + platform prerequisites
dude dev      # run the desktop app with hot-reload
```
