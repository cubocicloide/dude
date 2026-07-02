import { existsSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'
import { capture, isAvailable, localBin } from '../_exec.js'

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
