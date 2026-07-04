import { spawn, spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'

/**
 * Regenerate `docs/docs/api.md` from the live command catalog so the docs always
 * match this project's real commands (init choices + .dude/commands/). Best
 * effort: a dynamic import keeps it working even on an older CLI runtime that
 * doesn't yet export `generateApiDoc` — we just skip the refresh in that case.
 */
async function regenerateApiDoc(projectRoot: string, docsDir: string): Promise<void> {
  try {
    const dude = (await import('@cubocicloide/dude')) as {
      generateApiDoc?: (cwd: string, format?: 'md' | 'json') => Promise<string>
    }
    if (typeof dude.generateApiDoc !== 'function') return
    const md = await dude.generateApiDoc(projectRoot, 'md')
    writeFileSync(path.join(docsDir, 'docs', 'api.md'), md)
    process.stdout.write('[docs] Regenerated docs/api.md from the live command catalog.\n')
  } catch (e) {
    process.stderr.write(
      `[docs] Could not regenerate api.md (${(e as Error).message}); using the existing file.\n`,
    )
  }
}

function isDockerRunning(): boolean {
  const r = spawnSync('docker', ['info'], { stdio: 'ignore' })
  return r.error == null && r.status === 0
}

function openBrowser(url: string): void {
  if (process.platform === 'win32') {
    spawnSync('cmd', ['/c', 'start', '', url], { stdio: 'ignore' })
    return
  }
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open'
  spawnSync(opener, [url], { stdio: 'ignore' })
}

export const docsCommand: StackCommandDef = {
  description:
    'Serve the project documentation in dev mode (live-reload) at http://localhost:8001.',
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
    const url = `http://localhost:${port}`

    if (!existsSync(docsDir)) {
      process.stderr.write(
        '[docs] No docs/ folder found in the project root. Make sure you ran `dude init`.\n',
      )
      process.exit(1)
    }

    // Refresh the generated API reference before serving, so it's always current.
    await regenerateApiDoc(projectRoot, docsDir)

    if (!isDockerRunning()) {
      process.stderr.write('[docs] Docker is not running. Start Docker Desktop and retry.\n')
      process.exit(1)
    }

    process.stdout.write(`[docs] Starting MkDocs at ${url} (Ctrl+C to stop)\n`)

    const child = spawn(
      'docker',
      [
        'run',
        '--rm',
        '-i',
        '-p',
        `${port}:8000`,
        '-v',
        `${docsDir}:/docs`,
        'squidfunk/mkdocs-material',
        'serve',
        '--dev-addr=0.0.0.0:8000',
      ],
      { stdio: ['inherit', 'pipe', 'pipe'] },
    )

    if (child.pid == null) {
      process.stderr.write('[docs] Failed to start Docker container.\n')
      process.exit(1)
    }

    let browserOpened = false

    function watchChunk(chunk: Buffer): void {
      if (!browserOpened && chunk.toString().includes('Serving on')) {
        browserOpened = true
        process.stdout.write(`[docs] Opening ${url}\n`)
        openBrowser(url)
      }
    }

    child.stdout?.on('data', (chunk: Buffer) => {
      process.stdout.write(chunk)
      watchChunk(chunk)
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk)
      watchChunk(chunk)
    })

    await new Promise<void>((resolve) => child.on('close', resolve))
  },
}
