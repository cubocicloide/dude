/**
 * Shared `docs` command definition.
 *
 * Every stack served its project documentation identically — refresh the
 * generated pages, then run MkDocs Material in Docker with live reload — so it
 * lives here once and stacks register it with just their own wording:
 *
 *   // stacks/<stack>/src/index.ts
 *   import { defineDocsCommand } from '@cubocicloide/dude'
 *   commands: {
 *     docs: defineDocsCommand(),
 *   }
 *
 * Before this existed the six stacks carried byte-identical 117-line copies of
 * this file, so adding a generated page meant editing six places — the
 * duplication epic #113 exists to remove. Same reasoning as
 * `defineLintCommand()`: never hand-roll a per-stack wrapper.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '../stack-contract.js'
import { buildCatalog, catalogToMarkdown } from '../../commands/help/index.js'
import { generateCheatsheet } from '../cheatsheet/index.js'

export interface DocsCommandOptions {
  /** Command description shown by `dude help`. */
  description?: string
  /** Default host port for the docs site. */
  defaultPort?: string
}

/**
 * Pages regenerated on every `dude docs`, so the site always matches the real
 * project rather than what was true at scaffold time.
 *
 * The renderers are imported directly — this code now lives inside the CLI, so
 * there is no cross-package boundary to guard with a dynamic import the way the
 * old per-stack copies did. What replaces that guard is `minDudeVersion`: a stack
 * registering this command declares the CLI version that first exported it.
 */
const GENERATED_PAGES = [
  {
    file: 'api.md',
    label: 'the live command catalog',
    render: async (root: string) => {
      const { catalog, stackName } = await buildCatalog(root)
      return catalogToMarkdown(catalog, stackName)
    },
  },
  {
    file: 'cheatsheet.md',
    label: 'the project cheatsheet',
    render: (root: string) => generateCheatsheet(root, 'md'),
  },
] as const

/**
 * Refresh the generated pages. Each is independent and best-effort: one failing
 * leaves its committed placeholder in place and never blocks serving the site.
 */
async function refreshGeneratedPages(projectRoot: string, docsDir: string): Promise<void> {
  for (const page of GENERATED_PAGES) {
    const target = path.join(docsDir, 'docs', page.file)
    // Only refresh a page the scaffold actually ships — a stack may not include
    // every generated page, and writing an unexpected file would break its nav.
    if (!existsSync(target)) continue
    try {
      writeFileSync(target, await page.render(projectRoot))
      process.stdout.write(`[docs] Regenerated docs/${page.file} from ${page.label}.\n`)
    } catch (e) {
      process.stderr.write(
        `[docs] Could not regenerate ${page.file} (${(e as Error).message}); using the existing file.\n`,
      )
    }
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

export function defineDocsCommand(options: DocsCommandOptions = {}): StackCommandDef {
  const defaultPort = options.defaultPort ?? '8001'
  return {
    description:
      options.description ??
      'Serve the project documentation in dev mode (live-reload) at http://localhost:8001.',
    args: {
      port: {
        type: 'string',
        description: `Host port to expose the docs site on (default: ${defaultPort}).`,
        default: defaultPort,
      },
    },
    async run({ projectRoot, args }) {
      const docsDir = path.join(projectRoot, 'docs')
      const port = String(args.port ?? defaultPort)
      const url = `http://localhost:${port}`

      if (!existsSync(docsDir)) {
        process.stderr.write(
          '[docs] No docs/ folder found in the project root. Make sure you ran `dude init`.\n',
        )
        process.exit(1)
      }

      // Refresh before serving, so what you read is always current.
      await refreshGeneratedPages(projectRoot, docsDir)

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
}
