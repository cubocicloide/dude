import { existsSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'
import { runTauri } from '../_exec.js'
import { ANDROID_TARGETS, androidSdkRoot, ensureRustTargets } from '../_mobile.js'

function preflight(): void {
  if (androidSdkRoot() == null) {
    process.stderr.write(
      'warning: ANDROID_HOME (or ANDROID_SDK_ROOT) is not set — install Android Studio\n' +
        'and the SDK/NDK first: https://tauri.app/start/prerequisites/#android\n' +
        'Run `dude doctor` to see what is missing.\n\n',
    )
  }
}

export const androidInitCommand: StackCommandDef = {
  description:
    'One-time Android setup: install the Rust targets and generate the native project (src-tauri/gen/android).',
  async run({ projectRoot }) {
    preflight()
    if (!ensureRustTargets(ANDROID_TARGETS, projectRoot)) {
      process.stderr.write('error: could not install the Android Rust targets (is rustup on PATH?).\n')
      process.exit(1)
    }

    if (!runTauri(projectRoot, ['android', 'init'])) process.exit(1)

    // The generated project ships Tauri's default icons — overwrite them with
    // this app's icon set (tauri icon writes mobile icons into gen/).
    if (existsSync(path.join(projectRoot, 'app-icon.png'))) {
      process.stdout.write('\nRefreshing icons into the generated Android project…\n')
      runTauri(projectRoot, ['icon', 'app-icon.png'])
    }

    process.stdout.write(
      '\nAndroid project ready — commit src-tauri/gen/android, then run `dude android dev`.\n',
    )
  },
}

export const androidDevCommand: StackCommandDef = {
  description: 'Run the app on an Android device or emulator (tauri android dev, hot-reload).',
  args: {
    open: {
      type: 'boolean',
      description: 'Open the project in Android Studio instead of running directly.',
      default: false,
    },
    host: {
      type: 'boolean',
      description: 'Expose the dev server on the local network (required for physical devices).',
      default: false,
    },
  },
  async run({ projectRoot, args }) {
    preflight()
    const tauriArgs = ['android', 'dev']
    if (args.open) tauriArgs.push('--open')
    if (args.host) tauriArgs.push('--host')
    if (!runTauri(projectRoot, tauriArgs)) process.exit(1)
  },
}

export const androidBuildCommand: StackCommandDef = {
  description: 'Build the Android app bundle/APK (tauri android build).',
  args: {
    debug: {
      type: 'boolean',
      description: 'Build a debug binary (faster compile, devtools enabled).',
      default: false,
    },
    apk: {
      type: 'boolean',
      description: 'Produce an APK (sideloading / direct install).',
      default: false,
    },
    aab: {
      type: 'boolean',
      description: 'Produce an AAB (Play Store upload).',
      default: false,
    },
    target: {
      type: 'string',
      description: 'Comma-separated ABI targets: aarch64, armv7, i686, x86_64 (default: all).',
      required: false,
    },
  },
  async run({ projectRoot, args }) {
    preflight()
    const tauriArgs = ['android', 'build']
    if (args.debug) tauriArgs.push('--debug')
    if (args.apk) tauriArgs.push('--apk')
    if (args.aab) tauriArgs.push('--aab')
    if (typeof args.target === 'string' && args.target) {
      tauriArgs.push('--target', ...String(args.target).split(','))
    }
    if (!runTauri(projectRoot, tauriArgs)) process.exit(1)
  },
}
