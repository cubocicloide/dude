import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'

function isDockerRunning(): boolean {
  const r = spawnSync('docker', ['info'], { stdio: 'ignore' })
  return r.error == null && r.status === 0
}

export const docsCommand: StackCommandDef = {
  description: 'Serve the project documentation in dev mode (live-reload) at http://localhost:8001.',
  args: {
    port: {
      type: 'string',
      description: 'Host port to expose the docs site on (default: 8001).',
      default: '8001',
    },
  },
  async run({ projectRoot, args }) {
    const docsDir = path.join(projectRoot, 'docs')
    const port = String(args.port ?? '8001')

    if (!existsSync(docsDir)) {
      process.stderr.write(
        '[docs] No docs/ folder found in the project root. Make sure you ran `dude init`.\n',
      )
      process.exit(1)
    }

    if (!isDockerRunning()) {
      process.stderr.write('[docs] Docker is not running. Start Docker Desktop and retry.\n')
      process.exit(1)
    }

    process.stdout.write(`[docs] Starting MkDocs at http://localhost:${port} (Ctrl+C to stop)\n`)

    const result = spawnSync(
      'docker',
      [
        'run', '--rm', '-it',
        '-p', `${port}:8000`,
        '-v', `${docsDir}:/docs`,
        'squidfunk/mkdocs-material',
        'serve', '--dev-addr=0.0.0.0:8000',
      ],
      { stdio: 'inherit' },
    )

    if (result.error != null) {
      process.stderr.write(`[docs] Failed to start container: ${result.error.message}\n`)
      process.exit(1)
    }
  },
}
