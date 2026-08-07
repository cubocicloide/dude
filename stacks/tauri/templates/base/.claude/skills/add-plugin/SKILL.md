---
name: add-plugin
description: Wire a Tauri 2 plugin into this app end-to-end — Rust crate in src-tauri/Cargo.toml, .plugin(…) in lib.rs, the JS package in package.json, and the exact permission in src-tauri/capabilities/. Use when asked to add a plugin (fs, dialog, store, shell, notification, http, updater, …) or when a feature fails at runtime with a "not allowed"/"permission" error.
disable-model-invocation: false
allowed-tools: "Read Write Edit Glob Grep Bash(dude *) Bash(find *) Bash(cat *) Bash(grep *) Bash(ls *) Bash(pnpm *) Bash(cargo *)"
---

# Add a Tauri plugin

A Tauri plugin is **four wirings, not one**. Miss any of them and the failure
mode is silent or misleading:

| Missing | Symptom |
| ------- | ------- |
| Rust crate in `Cargo.toml` | compile error (the honest one) |
| `.plugin(…)` in `lib.rs` | runtime: *"plugin `x` not found"* on first call |
| JS package in `package.json` | `tsc` / Vite resolve error |
| Permission in `capabilities/` | runtime: *"x.y not allowed. Permissions associated with this command: …"* |

This skill does all four in one pass. `dude lint` covers the last one
structurally (BE010); the rest is why the checklist exists.

> Read `.claude/rules/BE/009.md`, `.claude/rules/BE/010.md` and
> `.claude/rules/FE/009.md` before starting — they are the source of truth for
> the security-relevant steps. `dude explain BE010` prints the same prose.

---

## Step 0 — Locate the project

```bash
find . -maxdepth 3 -name "dude.json" | head -1
```

Set `PROJECT_ROOT` to the directory containing `dude.json`. If missing, stop
with _"No dude.json found — are you inside a dude project?"_.

---

## Step 1 — Establish which plugin, and for which platforms

Ask only for what the user hasn't already given:

1. **Which plugin** — the official ones are `tauri-plugin-<name>` on crates.io
   and `@tauri-apps/plugin-<name>` on npm (`fs`, `dialog`, `store`, `shell`,
   `notification`, `http`, `clipboard-manager`, `global-shortcut`, `updater`, …).
2. **What it is for** — the concrete capability the app needs (e.g. "let the
   user pick a file", "persist window size"). This determines which permission
   to grant, and it is almost never the plugin's whole `:default` set.
3. **Which targets** — desktop only, or mobile too? Plugin platform support
   differs (`global-shortcut` and `updater`, for example, are desktop-only).
   Check the plugin's platform table before wiring it; this project targets
   desktop **and** iOS/Android (see `docs/docs/mobile.md`).

---

## Step 2 — Survey what is already wired (reuse before adding)

The project ships two plugins already — read them as the reference wiring:

```bash
grep -n "tauri-plugin" "$PROJECT_ROOT/src-tauri/Cargo.toml"
grep -n "\.plugin(" "$PROJECT_ROOT/src-tauri/src/lib.rs"
grep -n "@tauri-apps/plugin" "$PROJECT_ROOT/package.json"
cat "$PROJECT_ROOT/src-tauri/capabilities/default.json"
```

You should see `tauri-plugin-log` (registered via a `Builder`) and
`tauri-plugin-opener` (registered via `init()`), with `log:default` and
`opener:default` in the capability. Mirror whichever pattern the new plugin
uses, and report what you found before changing anything.

If the plugin is already present in all four places, stop and say so — the
problem is then a **missing permission**, so go straight to Step 5.

---

## Step 3 — Install both halves

```bash
cd "$PROJECT_ROOT/src-tauri" && cargo add tauri-plugin-<name>
cd "$PROJECT_ROOT" && pnpm add @tauri-apps/plugin-<name>
```

Notes:
- Use **pnpm**, never npm/yarn (`package.json` and the lockfile assume it).
- Some plugins have no JS half (they are used only from Rust) — skip the pnpm
  step then, and say so.
- `cargo add` picks the version matching the Tauri 2 line already in
  `Cargo.toml`. Do not hand-edit the version to something newer than `tauri = "2"`
  supports.
- Do not touch `[lib] crate-type` or the `[profile.release]` block while you are
  in `Cargo.toml` — mobile builds depend on the former (BE012).

---

## Step 4 — Register it in `lib.rs` (BE001)

`lib.rs` owns the Builder chain — plugins are registered there and nowhere else:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_log::Builder::new().build())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_<name>::init())          // ← new
    .setup(|app| { … })
```

- Most plugins expose `init()`; a configurable one (like `log`) exposes a
  `Builder`. Follow the plugin's own README — guessing produces a compile error,
  not a silent bug, so verify by compiling.
- **Desktop-only plugin** → guard it so mobile still builds. A `#[cfg(desktop)]`
  block cannot sit inside a fluent chain, so bind the builder to a variable
  first:

  ```rust
  let mut builder = tauri::Builder::default()
      .plugin(tauri_plugin_log::Builder::new().build())
      .plugin(tauri_plugin_opener::init());

  #[cfg(desktop)]
  {
      builder = builder.plugin(tauri_plugin_global_shortcut::Builder::new().build());
  }

  builder
      .setup(|app| { … })
      .invoke_handler(tauri::generate_handler![…])
      .run(tauri::generate_context!())
      .expect("error while running tauri application");
  ```

  Restructuring `run()` this way is fine — but keep the `generate_handler![…]`
  list intact (BE005) and the `#[cfg_attr(mobile, …)]` attribute on `run()`
  (BE012).

- Leave `#[cfg_attr(mobile, tauri::mobile_entry_point)]` on `run()` untouched
  (BE012), and do not add `#[tauri::command]` functions here — those belong in
  `src-tauri/src/commands/` (BE003).

---

## Step 5 — Grant the exact permission (BE010)

Add the permission to `src-tauri/capabilities/default.json` — the smallest set
that makes the feature work:

```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-set-title",
    "opener:default",
    "log:default",
    "<name>:allow-<command>"
  ]
}
```

Rules of thumb:
- Prefer `<name>:allow-<command>` over `<name>:default` when one command
  suffices — `:default` is a bundle and usually grants more than you need.
- **Never** use a wildcard: `dude lint` flags any permission containing `*` as
  a BE010 warning.
- Scoped plugins (`fs`, `shell`, `http`) take an object form with a scope —
  narrow it to the directories/URLs actually used:

  ```json
  { "identifier": "fs:allow-read-text-file", "allow": [{ "path": "$APPDATA/**" }] }
  ```

- A permission needed only on some targets can go in its own capability file
  with a `"platforms"` array, rather than widening the default one. Any new file
  in `src-tauri/capabilities/` must still declare `identifier`, `windows` and
  `permissions` or BE010 errors.

The best source for the exact permission string is the runtime error itself: it
names the permission it wanted. Run the app, trigger the feature, copy the name.

> `src-tauri/gen/schemas/` (which backs the `$schema` reference in the capability
> file) is generated by the build and gitignored — it refreshes on the next
> `dude dev`/`dude build`. Do not create or edit it by hand.

---

## Step 6 — Decide how the frontend reaches it

Two legitimate shapes — pick deliberately:

**A. Call the plugin's JS package directly from a page/component.**
Correct for plugins whose JS API *is* the feature. FE009 only forbids
`@tauri-apps/api/core` (`invoke`) and `window.__TAURI__`; a plugin package is
not `invoke`, so this passes lint. The Home page already does exactly this:

```tsx
import { openUrl } from '@tauri-apps/plugin-opener'
```

**B. Use the plugin from Rust and expose your own command.**
Correct when the app has domain logic around the plugin (validation, state,
combining several plugin calls). Then it is a normal command domain — follow
`/create-command`: module under `src-tauri/src/commands/<domain>.rs`, declared
in `commands/mod.rs` (BE004), registered in `generate_handler![…]` (BE005),
with a typed wrapper `src/ipc/<domain>.ts` and its barrel export (FE009, FE011).

Either way: if the plugin emits events, subscribe through the `useTauriEvent`
hook only — never import `@tauri-apps/api/event` in a page or component (FE010).

If the plugin's Rust errors need to cross IPC, add a variant to `AppError` in
`src-tauri/src/error.rs` with `#[from]` so command bodies propagate with `?`
instead of `unwrap()` (BE006, BE007):

```rust
#[error(transparent)]
Store(#[from] tauri_plugin_store::Error),
```

---

## Step 7 — Validate

```bash
cd "$PROJECT_ROOT"
dude lint            # BE010 capability hygiene, BE005 handler parity, FE rules
dude test            # cargo test — the Rust side still compiles and passes
dude review          # ESLint + tsc + cargo fmt --check + cargo clippy
```

If `dude lint` reports a code, run `dude explain <CODE>` and fix the cause — do
not work around the diagnostic. Then prove the wiring at runtime, because none
of the checks above can see a missing permission:

```bash
dude dev             # launch, trigger the feature, watch for a permission error
```

A *"not allowed. Permissions associated with this command"* message means Step 5
is incomplete — add the permission it names and relaunch.

---

## Step 8 — Report

```
Plugin wired
═════════════════════════════════════════
Plugin      tauri-plugin-<name> / @tauri-apps/plugin-<name>
Rust dep    src-tauri/Cargo.toml
Registered  src-tauri/src/lib.rs (.plugin(…))     <desktop-only: yes/no>
JS dep      package.json                          <or n/a>
Permission  src-tauri/capabilities/default.json → <name>:allow-<command>
Frontend    <direct JS package | src/ipc/<domain>.ts wrapper | n/a>
AppError    <variant added | unchanged>
─────────────────────────────────────────
dude lint:   ✓
dude test:   ✓
dude review: ✓
dude dev:    ✓ feature exercised, no permission error
```
