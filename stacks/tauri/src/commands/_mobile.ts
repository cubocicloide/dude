import { capture, exec } from './_exec.js'

/** Rust targets required by `tauri android dev/build`. */
export const ANDROID_TARGETS = [
  'aarch64-linux-android',
  'armv7-linux-androideabi',
  'i686-linux-android',
  'x86_64-linux-android',
]

/** Rust targets required by `tauri ios dev/build` (device + simulators). */
export const IOS_TARGETS = ['aarch64-apple-ios', 'aarch64-apple-ios-sim', 'x86_64-apple-ios']

/** The Android SDK root, from either env var the tooling accepts. */
export function androidSdkRoot(): string | undefined {
  return process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT
}

/** Rust targets currently installed via rustup ('' when rustup is missing). */
export function installedRustTargets(): string {
  return capture('rustup', ['target', 'list', '--installed']) ?? ''
}

/**
 * Install any missing Rust cross-compilation targets (idempotent, fast when
 * everything is already present). Returns false when rustup is unavailable
 * or the install fails.
 */
export function ensureRustTargets(targets: string[], cwd: string): boolean {
  const installed = installedRustTargets()
  const missing = targets.filter((t) => !installed.includes(t))
  if (missing.length === 0) return true

  process.stdout.write(`Installing Rust targets: ${missing.join(', ')}…\n`)
  return exec('rustup', ['target', 'add', ...missing], cwd)
}
