---
name: release-mobile
description: Take this app to Android and/or iOS — preflight the toolchain and the mobile-critical lint rules, run the one-time native init, bump the version, verify on a device, then produce the signed APK/AAB/IPA with dude android build / dude ios build. Use when asked to ship, release, or build the mobile app, or to set the project up for mobile for the first time.
disable-model-invocation: false
allowed-tools: "Read Write Edit Glob Grep Bash(dude *) Bash(find *) Bash(cat *) Bash(grep *) Bash(ls *) Bash(git *)"
---

# Release the mobile app

The same codebase builds desktop and mobile — `lib.rs` already carries
`#[cfg_attr(mobile, tauri::mobile_entry_point)]` (BE012), so no application code
changes are needed to go mobile. What *does* bite is everything around the code:
a placeholder bundle identifier, a stale version, an unsigned artifact, a
generated native project that was never committed.

This skill walks that path in order and refuses to skip the preflight, because
every one of those failures shows up **after** a long cross-compile.

> Reference docs in this project: `docs/docs/mobile.md` (prerequisites, dev loop,
> release commands) and `docs/docs/distribute.md` (signing). Preview them with
> `dude docs`.

---

## Step 0 — Locate the project

```bash
find . -maxdepth 3 -name "dude.json" | head -1
```

Set `PROJECT_ROOT` to the directory containing `dude.json`. If missing, stop
with _"No dude.json found — are you inside a dude project?"_.

---

## Step 1 — Establish the target and the intent

Ask only for what the user hasn't already given:

1. **Platform** — Android, iOS, or both.
2. **Artifact** —
   - Android: `--aab` (Play Store upload) or `--apk` (sideload / direct install)
   - iOS: `--export-method app-store-connect` (default), `release-testing`
     (TestFlight/ad-hoc) or `debugging`
3. **Release or internal test** — a `--debug` build compiles faster and keeps
   devtools on, but is not distributable.
4. **Version** — is this a new store version, or a rebuild of the current one?

> `dude ios *` only exists on macOS (the commands declare themselves unavailable
> elsewhere, so they will not appear in `dude help`). If the user asks for iOS on
> Linux/Windows, say so and stop that half.

---

## Step 2 — Preflight the toolchain

```bash
cd "$PROJECT_ROOT"
dude doctor
```

Read the rows marked **(mobile)** — they are advisory for desktop work but
required here:

| Row | Needed for |
| --- | ---------- |
| `Android SDK (mobile)` / `Android NDK (mobile)` / `Java runtime (mobile)` | any `dude android *` |
| `Rust Android targets (mobile)` | `dude android build` — installed by `dude android init` |
| `Xcode (mobile iOS)` — full Xcode, not just the Command Line Tools | any `dude ios *` |
| `CocoaPods (mobile iOS)` | `dude ios init`/`build` |
| `Rust iOS targets (mobile)` | `dude ios build` — installed by `dude ios init` |

Anything missing that `init` does not install (SDK, NDK, `ANDROID_HOME`,
`NDK_HOME`, Xcode, CocoaPods) must be fixed by the user first — report exactly
which rows failed and stop rather than starting a build that will die halfway.

---

## Step 3 — Preflight the mobile-critical rules

These two lint rules exist specifically because their broken states only surface
during a mobile build:

```bash
dude lint --format json
```

- **BE009** — `identifier` in `src-tauri/tauri.conf.json`. A placeholder
  (`com.tauri.dev`, `com.tauri.app`, empty) is an **error**; an identifier
  containing anything outside `[a-zA-Z0-9.]` is only a **warning**, so it will
  *not* fail `dude lint` — treat it as blocking anyway, because Android package
  names forbid dashes and Apple bundle IDs forbid underscores. Check it by eye:

  ```bash
  grep -n '"identifier"' "$PROJECT_ROOT/src-tauri/tauri.conf.json"
  ```

  Changing it **after** a store release orphans the installed app and its data —
  if it is wrong, fix it now, before the first upload, and never after.

- **BE012** — `run()` in `src-tauri/src/lib.rs` must keep
  `#[cfg_attr(mobile, tauri::mobile_entry_point)]`; without it the native project
  links against a missing entry point, with an unhelpful error. The lint check
  covers that attribute. The rule also requires keeping
  `[lib] crate-type = ["staticlib", "cdylib", "rlib"]` in `src-tauri/Cargo.toml`
  (`staticlib`/`cdylib` are the mobile link formats) — that half is **not**
  machine-checked, so verify it yourself:

  ```bash
  grep -n -A3 '^\[lib\]' "$PROJECT_ROOT/src-tauri/Cargo.toml"
  ```

Run `dude explain BE009` / `dude explain BE012` for the full prose. Then confirm
the whole project is green before spending compile time:

```bash
dude lint && dude test && dude review
```

---

## Step 4 — One-time native project setup

Check whether the native projects already exist:

```bash
ls "$PROJECT_ROOT/src-tauri/gen/android" 2>/dev/null && echo "android: initialised"
ls "$PROJECT_ROOT/src-tauri/gen/apple"   2>/dev/null && echo "ios: initialised"
```

If a platform is missing, initialise it — this installs the Rust
cross-compilation targets, generates the native project and refreshes the app
icons into it from `app-icon.png`:

```bash
dude android init      # → src-tauri/gen/android
dude ios init          # → src-tauri/gen/apple   (macOS only)
```

Then **commit `src-tauri/gen/`**. Only `src-tauri/gen/schemas/` is gitignored;
the native projects are scaffolded once, version-controlled, and edited
deliberately for native-level customisation (`AndroidManifest.xml`, `Info.plist`,
signing config). Do not re-run `init` on an initialised platform — it can
overwrite those edits.

```bash
git add src-tauri/gen && git commit -m "chore(mobile): add generated <platform> project"
```

---

## Step 5 — Version and icons

Bump the app version for a store release — stores reject a version that was
already uploaded:

- `src-tauri/tauri.conf.json` → `"version"` — **this is the one the bundles use**
- `package.json` → `"version"` — keep in step
- `src-tauri/Cargo.toml` → `[package] version` — keep in step

If the icon changed since the native projects were generated, regenerate it:

```bash
dude icon                          # from ./app-icon.png
dude icon --source path/to/1024.png
```

`dude icon` runs the same `tauri icon` call `init` does: it rewrites
`src-tauri/icons/` and refreshes the generated native projects' icons when they
exist. The source must be a square PNG, 1024×1024 or larger.

---

## Step 6 — Verify on a real target before building a release

A release build takes minutes per ABI; a dev run takes seconds and catches the
layout and permission problems that only appear on mobile.

```bash
dude android dev              # emulator  (--open to hand off to Android Studio)
dude ios dev                  # simulator (--open to hand off to Xcode)

dude android dev --host       # physical device on the same LAN
dude ios dev --host
```

`--host` exposes the Vite dev server on your LAN IP (wired through
`TAURI_DEV_HOST` in `vite.config.ts`) so the device can reach it; hot-reload
works on device.

What to check while it runs:
- **Layout** — the window size in `tauri.conf.json` is ignored on mobile; the
  webview fills the screen. Verify the antd grid actually adapts (the Home page
  is the reference).
- **Permissions** — a *"not allowed"* runtime error means a missing entry in
  `src-tauri/capabilities/` (BE010). Add exactly the permission the error names;
  see `/add-plugin` Step 5.
- **Plugins** — platform support differs per plugin. `log` and `opener` (the two
  this project ships) both support mobile; anything added since must be checked.

---

## Step 7 — Signing

Unsigned artifacts install nowhere but your own machine. Signing lives in the
native projects, not in `tauri.conf.json`:

- **Android** — create a keystore and wire it into the Gradle config under
  `src-tauri/gen/android`. Keep the keystore and its passwords **out of the
  repo** (CI secret store, or a gitignored properties file); losing the keystore
  means you can never update the Play listing again.
- **iOS** — certificates and provisioning profiles are configured through Xcode
  against `src-tauri/gen/apple`, tied to your Apple Developer team.

Never commit certificates, keystores or credentials. See `docs/docs/distribute.md`
and the [Tauri distribution guide](https://tauri.app/distribute/) for the
store-specific steps.

---

## Step 8 — Build

```bash
# Android
dude android build --aab                        # Play Store bundle, all ABIs
dude android build --apk                        # sideloadable APK, all ABIs
dude android build --apk --target aarch64       # one ABI — much faster
dude android build --debug --apk                # internal test build

# iOS (macOS only)
dude ios build                                  # IPA, app-store-connect export
dude ios build --export-method release-testing  # TestFlight / ad-hoc
dude ios build --export-method debugging        # development
dude ios build --debug
```

`--target` on Android takes a comma-separated list of `aarch64`, `armv7`,
`i686`, `x86_64` (default: all four). Restrict it while iterating; ship all of
them (or an AAB, which splits per ABI for you) for the store.

The build prints the absolute path of each artifact it produced — read it from
the output rather than guessing, and report that exact path.

---

## Step 9 — Report

```
Mobile release
═════════════════════════════════════════
Platform    <android | ios | both>
Version     <tauri.conf.json version>   identifier: <bundle id>
Init        <already present | generated + committed>
Icons       <refreshed | unchanged>
Device run  <emulator/simulator/physical — what was verified>
Signing     <configured | ad-hoc/unsigned — NOT distributable>
─────────────────────────────────────────
dude doctor: ✓ (mobile rows)
dude lint:   ✓   dude test: ✓   dude review: ✓
Artifacts:
  <absolute path printed by the build>
```

If the build was `--debug` or unsigned, say so explicitly in the report — an
artifact that cannot be distributed must never be handed over as if it could.
