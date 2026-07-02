import { existsSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'
import { exec, isAvailable, section, verdict } from '../_exec.js'

export const testCommand: StackCommandDef = {
  description: 'Run the Rust test suite (cargo test — unit tests live next to each command module).',
  args: {
    filter: {
      type: 'string',
      description: 'Only run tests whose name contains this string (cargo test <filter>).',
      required: false,
    },
    release: {
      type: 'boolean',
      description: 'Run tests in release mode.',
      default: false,
    },
  },
  async run({ projectRoot, args }) {
    const tauriDir = path.join(projectRoot, 'src-tauri')

    if (!existsSync(tauriDir)) {
      process.stderr.write('[test] No src-tauri/ folder found. Make sure you ran `dude init`.\n')
      process.exit(1)
    }
    if (!isAvailable('cargo')) {
      process.stderr.write(
        'error: cargo is required but was not found on your PATH:\n\n' +
          '  • Rust  →  https://www.rust-lang.org/tools/install\n\n',
      )
      process.exit(1)
    }

    const cargoArgs = ['test']
    if (args.release) cargoArgs.push('--release')
    if (typeof args.filter === 'string' && args.filter) cargoArgs.push(args.filter)

    section('cargo test')
    const ok = exec('cargo', cargoArgs, tauriDir)
    verdict(ok, 'All tests passed.', 'Tests failed.')
  },
}
