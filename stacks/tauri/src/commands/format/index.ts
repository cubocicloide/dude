import { existsSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'
import { exec, isAvailable, localBin, section } from '../_exec.js'

export const formatCommand: StackCommandDef = {
  description: 'Format all sources — prettier (frontend) + cargo fmt (Rust backend).',
  args: {
    check: {
      type: 'boolean',
      description: 'Check formatting without writing changes (exits 1 if any file would change).',
      default: false,
    },
  },
  async run({ projectRoot, args }) {
    const check = Boolean(args.check)
    let ok = true

    // ── Frontend (prettier) ───────────────────────────────────────────────────
    section('prettier')
    const prettier = localBin(projectRoot, 'prettier')
    if (prettier == null) {
      process.stderr.write(
        'error: prettier is not installed in this project. Run `pnpm install` first.\n',
      )
      process.exit(1)
    }
    // Directories (not globs): prettier then skips files it has no parser for
    // (e.g. src/assets/*.svg) instead of erroring on them.
    ok = exec(prettier, [check ? '--check' : '--write', 'src', 'index.html'], projectRoot) && ok

    // ── Backend (cargo fmt) ───────────────────────────────────────────────────
    const tauriDir = path.join(projectRoot, 'src-tauri')
    if (existsSync(tauriDir)) {
      section('cargo fmt')
      if (!isAvailable('cargo')) {
        process.stderr.write(
          'error: cargo is required but was not found on your PATH:\n\n' +
            '  • Rust  →  https://www.rust-lang.org/tools/install\n\n',
        )
        process.exit(1)
      }
      ok = exec('cargo', ['fmt', ...(check ? ['--check'] : [])], tauriDir) && ok
    }

    if (!ok) process.exit(1)
  },
}
