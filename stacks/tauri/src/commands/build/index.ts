import type { StackCommandDef } from '@cubocicloide/dude'
import { runTauri } from '../_exec.js'

export const buildCommand: StackCommandDef = {
  description: 'Build the distributable desktop app (tauri build — bundles installers per platform).',
  args: {
    debug: {
      type: 'boolean',
      description: 'Build a debug binary (faster compile, devtools enabled).',
      default: false,
    },
    bundles: {
      type: 'string',
      description: 'Comma-separated bundle targets (e.g. "app,dmg", "deb,appimage", "msi"). Default: platform bundles.',
      required: false,
    },
    target: {
      type: 'string',
      description: 'Rust target triple to cross-compile for (e.g. aarch64-apple-darwin).',
      required: false,
    },
  },
  async run({ projectRoot, args }) {
    const tauriArgs = ['build']
    if (args.debug) tauriArgs.push('--debug')
    if (typeof args.bundles === 'string' && args.bundles) tauriArgs.push('--bundles', args.bundles)
    if (typeof args.target === 'string' && args.target) tauriArgs.push('--target', args.target)
    const ok = runTauri(projectRoot, tauriArgs)
    if (!ok) process.exit(1)
  },
}
