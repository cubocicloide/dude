# @cubocicloide/stack-tauri

## 0.3.0

### Minor Changes

- 2832af6: Add mobile (iOS/Android) support to the `tauri` stack — same codebase as
  desktop. New command groups `dude android init|dev|build` and
  `dude ios init|dev|build` (iOS gated to macOS): `init` installs the Rust
  cross-compilation targets and generates the native project
  (`src-tauri/gen/android` / `gen/apple`), refreshing the app icons into it;
  `dev` supports `--open` (IDE) and `--host` (physical devices); `build`
  exposes `--apk`/`--aab`/`--target` (Android) and `--export-method` (iOS).

  `dude doctor` now reports optional mobile prerequisites (Android SDK/NDK/Java/
  Rust targets, and on macOS Xcode/CocoaPods/iOS Rust targets). The bundle
  identifier is sanitized at scaffold time to stay mobile-portable
  (`com.<alnum>.app` — Android forbids dashes, Apple forbids underscores); a new
  lint check BE012 keeps the `mobile_entry_point` attribute on `lib.rs`, and
  BE009 now warns on non-portable identifiers.

  Generated docs gain a Mobile page (prerequisites, init/dev/build, signing) and
  a Distributing page explaining why an ad-hoc-signed desktop build shows
  "damaged" on another Mac and how to configure Developer ID signing +
  notarization (macOS) / SmartScreen signing (Windows) for real distribution.

## 0.2.0

### Minor Changes

- 2ccc3a6: Add the `tauri` stack: scaffolds a Tauri 2 desktop app (React 19 + Vite +
  Ant Design frontend, Rust backend) with an optional SQLite database
  (`--database sqlite`). Ships `dev`, `build`, `doctor`, `icon`, `lint`,
  `format`, `review`, `test` and `docs` commands, plus 22 structural lint
  checks (FE001–FE011 for the React side, BE001–BE011 for Rust/Tauri best
  practices) each documented in the generated project's `.claude/rules/`.
  The CLI registry now resolves the `tauri` stack name.

### Patch Changes

- Updated dependencies [2ccc3a6]
  - @cubocicloide/dude@0.11.3
