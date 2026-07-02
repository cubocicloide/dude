import { existsSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'
import { capture, isAvailable, localBin } from '../_exec.js'
import {
  ANDROID_TARGETS,
  IOS_TARGETS,
  androidSdkRoot,
  installedRustTargets,
} from '../_mobile.js'

interface CheckRow {
  label: string
  ok: boolean
  detail: string
  required: boolean
}

function row(label: string, ok: boolean, detail: string, required = true): CheckRow {
  return { label, ok, detail, required }
}

export const doctorCommand: StackCommandDef = {
  description: 'Verify the desktop toolchain: Node, Rust, Tauri CLI and platform prerequisites.',
  async run({ projectRoot }) {
    const rows: CheckRow[] = []

    // ── Node ──────────────────────────────────────────────────────────────────
    const nodeMajor = Number(process.versions.node.split('.')[0])
    rows.push(
      row('Node.js ≥ 20', nodeMajor >= 20, `v${process.versions.node}`),
    )

    // ── Rust toolchain ────────────────────────────────────────────────────────
    const rustc = capture('rustc', ['--version'])
    rows.push(
      row('rustc', rustc != null, rustc ?? 'not found — install from https://rustup.rs'),
    )
    const cargo = capture('cargo', ['--version'])
    rows.push(
      row('cargo', cargo != null, cargo ?? 'not found — install from https://rustup.rs'),
    )

    // ── Project dependencies / Tauri CLI ─────────────────────────────────────
    const depsInstalled = existsSync(path.join(projectRoot, 'node_modules'))
    rows.push(
      row(
        'project dependencies',
        depsInstalled,
        depsInstalled ? 'node_modules/ present' : 'missing — run `pnpm install`',
      ),
    )
    const tauriBin = localBin(projectRoot, 'tauri')
    rows.push(
      row(
        'Tauri CLI (local)',
        tauriBin != null,
        tauriBin ?? 'missing — run `pnpm install` (ships as a devDependency)',
      ),
    )

    // ── Platform-specific prerequisites ──────────────────────────────────────
    if (process.platform === 'darwin') {
      const xcode = capture('xcode-select', ['-p'])
      rows.push(
        row(
          'Xcode Command Line Tools',
          xcode != null,
          xcode ?? 'missing — run `xcode-select --install`',
        ),
      )
    } else if (process.platform === 'linux') {
      const pkgConfig = isAvailable('pkg-config')
      rows.push(
        row(
          'pkg-config (webkit2gtk deps)',
          pkgConfig,
          pkgConfig
            ? 'found'
            : 'missing — see https://tauri.app/start/prerequisites/ for your distro',
          false,
        ),
      )
    }

    // ── Optional tooling ──────────────────────────────────────────────────────
    rows.push(
      row(
        'Docker (only for `dude docs`)',
        isAvailable('docker'),
        isAvailable('docker') ? 'found' : 'not found — docs preview unavailable',
        false,
      ),
    )

    // ── Mobile prerequisites (optional — only for `dude android|ios *`) ──────
    const rustTargets = installedRustTargets()

    const sdk = androidSdkRoot()
    rows.push(
      row(
        'Android SDK (mobile)',
        sdk != null,
        sdk ?? 'ANDROID_HOME not set — see https://tauri.app/start/prerequisites/#android',
        false,
      ),
    )
    rows.push(
      row(
        'Android NDK (mobile)',
        process.env.NDK_HOME != null,
        process.env.NDK_HOME ?? 'NDK_HOME not set — install the NDK via Android Studio',
        false,
      ),
    )
    rows.push(
      row(
        'Java runtime (mobile)',
        isAvailable('java'),
        capture('java', ['--version'])?.split('\n')[0] ?? 'not found — ships with Android Studio',
        false,
      ),
    )
    rows.push(
      row(
        'Rust Android targets (mobile)',
        ANDROID_TARGETS.every((t) => rustTargets.includes(t)),
        ANDROID_TARGETS.every((t) => rustTargets.includes(t))
          ? 'installed'
          : 'missing — `dude android init` installs them',
        false,
      ),
    )

    if (process.platform === 'darwin') {
      const xcodebuild = capture('xcodebuild', ['-version'])
      rows.push(
        row(
          'Xcode (mobile iOS)',
          xcodebuild != null,
          xcodebuild?.split('\n')[0] ?? 'full Xcode required (CLT alone is not enough)',
          false,
        ),
      )
      rows.push(
        row(
          'CocoaPods (mobile iOS)',
          isAvailable('pod'),
          isAvailable('pod') ? 'found' : 'missing — `brew install cocoapods`',
          false,
        ),
      )
      rows.push(
        row(
          'Rust iOS targets (mobile)',
          IOS_TARGETS.every((t) => rustTargets.includes(t)),
          IOS_TARGETS.every((t) => rustTargets.includes(t))
            ? 'installed'
            : 'missing — `dude ios init` installs them',
          false,
        ),
      )
    }

    // ── Print report ──────────────────────────────────────────────────────────
    const isTTY = process.stdout.isTTY
    const mark = (r: CheckRow) =>
      r.ok ? (isTTY ? '\x1b[32m✔\x1b[0m' : 'OK ') : r.required ? (isTTY ? '\x1b[31m✘\x1b[0m' : 'FAIL') : (isTTY ? '\x1b[33m!\x1b[0m' : 'WARN')

    process.stdout.write('\n')
    const width = Math.max(...rows.map((r) => r.label.length)) + 2
    for (const r of rows) {
      process.stdout.write(`  ${mark(r)} ${r.label.padEnd(width)} ${r.detail}\n`)
    }
    process.stdout.write('\n')

    const failed = rows.filter((r) => r.required && !r.ok)
    if (failed.length > 0) {
      process.stderr.write(`${failed.length} required prerequisite(s) missing.\n`)
      process.exit(1)
    }
    process.stdout.write('Toolchain looks good — run `dude dev` to start the app.\n')
  },
}
