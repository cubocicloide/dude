import { existsSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'
import { capture, isAvailable, runTauri } from '../_exec.js'
import { IOS_TARGETS, ensureRustTargets } from '../_mobile.js'

const onMac = () => process.platform === 'darwin'

function guardDarwin(): void {
  if (!onMac()) {
    process.stderr.write('error: iOS development requires macOS with Xcode installed.\n')
    process.exit(1)
  }
}

function preflight(): void {
  if (capture('xcodebuild', ['-version']) == null) {
    process.stderr.write(
      'warning: full Xcode not detected (xcodebuild missing) — the Command Line Tools alone\n' +
        'are not enough for iOS: https://tauri.app/start/prerequisites/#ios\n',
    )
  }
  if (!isAvailable('pod')) {
    process.stderr.write(
      'warning: CocoaPods not found — install it with `brew install cocoapods`.\n',
    )
  }
}

export const iosInitCommand: StackCommandDef = {
  description:
    'One-time iOS setup: install the Rust targets and generate the native project (src-tauri/gen/apple).',
  available: onMac,
  async run({ projectRoot }) {
    guardDarwin()
    preflight()
    if (!ensureRustTargets(IOS_TARGETS, projectRoot)) {
      process.stderr.write('error: could not install the iOS Rust targets (is rustup on PATH?).\n')
      process.exit(1)
    }

    if (!runTauri(projectRoot, ['ios', 'init'])) process.exit(1)

    // The generated project ships Tauri's default icons — overwrite them with
    // this app's icon set (tauri icon writes mobile icons into gen/).
    if (existsSync(path.join(projectRoot, 'app-icon.png'))) {
      process.stdout.write('\nRefreshing icons into the generated iOS project…\n')
      runTauri(projectRoot, ['icon', 'app-icon.png'])
    }

    process.stdout.write(
      '\niOS project ready — commit src-tauri/gen/apple, then run `dude ios dev`.\n',
    )
  },
}

export const iosDevCommand: StackCommandDef = {
  description: 'Run the app on an iOS simulator or device (tauri ios dev, hot-reload).',
  available: onMac,
  args: {
    open: {
      type: 'boolean',
      description: 'Open the project in Xcode instead of running directly.',
      default: false,
    },
    host: {
      type: 'boolean',
      description: 'Expose the dev server on the local network (required for physical devices).',
      default: false,
    },
  },
  async run({ projectRoot, args }) {
    guardDarwin()
    preflight()
    const tauriArgs = ['ios', 'dev']
    if (args.open) tauriArgs.push('--open')
    if (args.host) tauriArgs.push('--host')
    if (!runTauri(projectRoot, tauriArgs)) process.exit(1)
  },
}

export const iosBuildCommand: StackCommandDef = {
  description: 'Build the iOS app archive/IPA (tauri ios build).',
  available: onMac,
  args: {
    debug: {
      type: 'boolean',
      description: 'Build a debug binary (faster compile, devtools enabled).',
      default: false,
    },
    exportMethod: {
      type: 'string',
      description:
        'IPA export method: app-store-connect, release-testing or debugging (default: app-store-connect).',
      required: false,
    },
  },
  async run({ projectRoot, args }) {
    guardDarwin()
    preflight()
    const tauriArgs = ['ios', 'build']
    if (args.debug) tauriArgs.push('--debug')
    if (typeof args.exportMethod === 'string' && args.exportMethod) {
      tauriArgs.push('--export-method', args.exportMethod)
    }
    if (!runTauri(projectRoot, tauriArgs)) process.exit(1)
  },
}
