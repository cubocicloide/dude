# Electron to Tauri 2 API map

Use this map to select the migration direction, then confirm exact APIs and
permissions in the current official Tauri documentation before editing.

| Electron source | Tauri 2 target | Migration rule |
| --- | --- | --- |
| `BrowserWindow` | `tauri.conf.json`, `WebviewWindow`, Rust `WebviewWindowBuilder` | Put static main-window settings in config; create dynamic windows in narrowly scoped Rust or typed frontend code. |
| `app` lifecycle | Rust `RunEvent`, `AppHandle`, `Manager` | Recreate ready, activate, exit, and window-close behavior in `lib.rs`; keep `main.rs` thin. |
| `ipcMain.handle` / `ipcRenderer.invoke` | `#[tauri::command]` + `invoke()` wrapper | Keep Rust bindings thin, return `Result<_, AppError>`, and expose one typed `src/ipc` wrapper. |
| `ipcMain`/`webContents.send` events | Tauri `Emitter` / `Listener` | Define event constants and subscribe through `useTauriEvent` so cleanup is owned. |
| `contextBridge` / preload globals | Typed `src/ipc` modules | Remove the preload layer; never recreate a broad global bridge. |
| `dialog` | `@tauri-apps/plugin-dialog` | Grant only the dialog operations used. Keep privileged follow-up filesystem work in Rust. |
| `shell.openExternal` / `openPath` | `@tauri-apps/plugin-opener` | Scope allowed URL schemes/paths. Use `plugin-shell` only for real child-process requirements. |
| `child_process` / Electron shell commands | Rust command or `@tauri-apps/plugin-shell` | Prefer a purpose-built Rust command. Never expose arbitrary command/argument execution. |
| `fs` | Rust `std::fs` or `@tauri-apps/plugin-fs` | Prefer Rust for application-owned data; scope plugin paths and operations precisely. |
| `path`, `app.getPath` | Tauri path API / `AppHandle.path()` | Map directories intentionally and handle legacy Electron `userData` separately. |
| `clipboard` | `@tauri-apps/plugin-clipboard-manager` | Enable only read or write permissions that the UI uses. |
| `Notification` | `@tauri-apps/plugin-notification` | Preserve permission checks and user-triggered behavior. |
| `globalShortcut` | `@tauri-apps/plugin-global-shortcut` | Use desktop-only capabilities and unregister shortcuts during cleanup. |
| `autoUpdater` / `electron-updater` | `@tauri-apps/plugin-updater` + process plugin | Preserve release-channel and signature behavior; do not enable unsigned updates. |
| `electron-store` | `@tauri-apps/plugin-store` or Rust persistence | Add a tested, one-time import only when the legacy file and schema are known. |
| SQLite packages | `rusqlite` or `@tauri-apps/plugin-sql` | Prefer the stack's Rust SQLite pattern for privileged/domain logic; migrate schemas explicitly. |
| Express/Koa servers and multipart middleware | Typed Tauri commands backed by Rust domain modules | Port each route and validation rule; do not bundle a hidden Node server merely to preserve HTTP-shaped renderer calls. |
| ZIP/archive packages | Maintained Rust archive crates behind narrow commands | Validate entry paths and size limits before extraction; preserve portable backup formats with compatibility tests. |
| `Menu`, `MenuItem` | Tauri menu APIs | Preserve roles, accelerators, platform differences, and event routing. |
| `Tray` | Tauri `TrayIcon` APIs | Preserve menus and click behavior; add only tray-related capabilities actually needed. |
| `screen` | Tauri monitor/window APIs | Translate monitor selection and bounds; account for logical versus physical coordinates. |
| `nativeTheme` | Window theme APIs or targeted platform Rust | Preserve only behavior used by the app; do not add theme plumbing speculatively. |
| `session`, cookies | Webview APIs or `@tauri-apps/plugin-http` | Determine whether state belongs to the webview or an HTTP client before translating. |
| `safeStorage`, `keytar` | Stronghold or a maintained OS-keyring Rust crate | Treat formats as incompatible unless a documented decryption/import path exists. |
| `single-instance-lock` | `@tauri-apps/plugin-single-instance` | Register early and forward arguments/URLs to the existing window. |
| Auto launch | `@tauri-apps/plugin-autostart` | Preserve enable/disable semantics and platform support. |
| Deep links / protocol registration | `@tauri-apps/plugin-deep-link` | Preserve schemes and argument routing; validate bundle configuration. |
| Window position persistence | `@tauri-apps/plugin-window-state` | Use when equivalent to custom Electron bounds storage; avoid double persistence. |
| `desktopCapturer`, power blockers, unsupported native addons | Narrow Rust/plugin implementation | Treat as a blocking domain until a secure platform implementation and tests exist. |

## Security checks

- Keep `nodeIntegration` absent; Tauri does not need an equivalent.
- Keep remote origins out of capabilities unless the source demonstrably loads
  remote application code and the user accepts that security model.
- Prefer per-window, per-operation permissions. Do not use wildcard filesystem
  or shell scopes to make tests pass.
- Preserve or tighten the scaffold CSP. Add network, image, font, or media
  sources individually from observed renderer requirements.
- Treat renderer-controlled paths and command arguments as untrusted input;
  validate and scope them again in Rust.

Official references:

- https://v2.tauri.app/start/create-project/
- https://v2.tauri.app/develop/calling-rust/
- https://v2.tauri.app/security/capabilities/
- https://v2.tauri.app/plugin/
