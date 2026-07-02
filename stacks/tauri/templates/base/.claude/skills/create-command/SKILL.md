---
name: create-command
description: Scaffold a new Tauri command domain end-to-end — Rust module (logic + thin bindings + tests), registration in mod.rs and generate_handler!, typed src/ipc wrapper and barrel export. Use when asked to add a backend command, IPC call, or expose new Rust functionality to the frontend.
---

# Create a Tauri command domain

Add a new command domain named after what it manages (e.g. `settings`,
`files`). Follow every step — `dude lint` enforces all of them.

## 1. Survey what exists

- Read `src-tauri/src/commands/` to see current domains — extend one if the
  new commands belong there.
- Read `src-tauri/src/error.rs` — reuse existing `AppError` variants; add a
  variant (with `#[from]` when wrapping a library error) only if needed.
- Check `src-tauri/src/state.rs` if the domain needs shared state.

## 2. Rust module — `src-tauri/src/commands/<domain>.rs`

Copy the structure of `counter.rs` (state + events) or `greet.rs` (pure):

- **Plain functions first** — domain logic takes plain values/`&Connection`
  and returns `Result<_, AppError>`; keep the `#[tauri::command]` bindings
  thin (BE011 makes this testable).
- Fallible commands return `Result<_, AppError>` (BE006); propagate with `?`,
  never `unwrap()`/`expect()` (BE007).
- Log with `log::info!`/`log::warn!` (BE008).
- Structs crossing IPC get `#[derive(Serialize)]` +
  `#[serde(rename_all = "camelCase")]`.
- If the domain pushes updates, define the event name as a
  `pub const <NAME>_EVENT: &str` and `app.emit(...)` after state changes.
- End with a `#[cfg(test)] mod tests` block covering the plain functions.

## 3. Register (BE004 + BE005)

- `src-tauri/src/commands/mod.rs` → `pub mod <domain>;`
- `src-tauri/src/lib.rs` → add every command to `generate_handler![…]`.

## 4. Typed wrapper — `src/ipc/<domain>.ts` (FE009/FE011)

One exported async function per command; argument keys camelCase (Tauri
converts to snake_case); mirror returned structs as TS interfaces; re-export
the event name constants. Then add `export * from './<domain>'` to
`src/ipc/index.ts`.

## 5. Validate

```bash
dude lint && dude test && dude review
```

If the UI needs a new page for the domain, follow up with /create-page.
