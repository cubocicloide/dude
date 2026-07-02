import type { StackCommandDef } from '@cubocicloide/dude'
import { runTauri } from '../_exec.js'

export const devCommand: StackCommandDef = {
  description: 'Run the desktop app in development mode (tauri dev, hot-reload).',
  args: {
    release: {
      type: 'boolean',
      description: 'Run the Rust backend in release mode (slower build, faster app).',
      default: false,
    },
  },
  async run({ projectRoot, args }) {
    const tauriArgs = ['dev']
    if (args.release) tauriArgs.push('--release')
    const ok = runTauri(projectRoot, tauriArgs)
    if (!ok) process.exit(1)
  },
}
