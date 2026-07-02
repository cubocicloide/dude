import { existsSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'
import { runTauri } from '../_exec.js'

export const iconCommand: StackCommandDef = {
  description: 'Regenerate the full app icon set (icns, ico, pngs) from a single source image.',
  args: {
    source: {
      type: 'string',
      description: 'Source image — a square PNG, at least 1024×1024 (default: ./app-icon.png).',
      default: 'app-icon.png',
    },
  },
  async run({ projectRoot, args }) {
    const source = String(args.source ?? 'app-icon.png')
    const sourcePath = path.isAbsolute(source) ? source : path.join(projectRoot, source)

    if (!existsSync(sourcePath)) {
      process.stderr.write(
        `error: source image not found: ${sourcePath}\n` +
          'Provide a square PNG (1024×1024 or larger), e.g.:\n\n' +
          '  dude icon --source path/to/icon.png\n\n',
      )
      process.exit(1)
    }

    const ok = runTauri(projectRoot, ['icon', sourcePath])
    if (!ok) process.exit(1)
    process.stdout.write('\nIcon set regenerated under src-tauri/icons/.\n')
  },
}
