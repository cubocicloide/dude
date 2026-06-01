import { defineCommand } from 'citty'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'pathe'
import yaml from 'yaml'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect all file paths under a directory. */
function walkAll(dir: string): string[] {
  const results: string[] = []
  if (!existsSync(dir)) return results
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(full, ...walkAll(full))
    } else {
      results.push(full)
    }
  }
  return results
}

/** `/api/todos/{id}/` → `['api', 'todos', '[id]']` */
function routeToSegments(route: string): string[] {
  return route.split('/').filter(Boolean).map((s) => s.replace(/{(.+?)}/g, '[$1]'))
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

export const apiReviewCommand = defineCommand({
  meta: {
    name: 'review',
    description: 'Validate the frontend/src/openapi/ tree against the saved OpenAPI spec.',
  },
  args: {
    root: {
      type: 'positional',
      description: 'Project root (defaults to current directory).',
      required: false,
    },
    out: {
      type: 'string',
      description: 'Generated openapi directory relative to root.',
      default: 'frontend/src/openapi',
    },
  },
  async run({ args }) {
    const root = path.resolve(args.root ?? process.cwd())
    const outDir = path.join(root, args.out)
    const yamlPath = path.join(outDir, 'utils', 'openapi.yaml')
    const isTTY = process.stdout.isTTY

    // -----------------------------------------------------------------------
    // 0. Guard: spec must exist
    // -----------------------------------------------------------------------
    if (!existsSync(yamlPath)) {
      process.stderr.write(
        `error: ${path.relative(root, yamlPath)} not found.\n` +
          `Run \`dude api sync\` first to fetch the spec.\n`,
      )
      process.exit(1)
    }

    // -----------------------------------------------------------------------
    // 1. Load spec and compute expected tree
    // -----------------------------------------------------------------------
    const spec = yaml.parse(readFileSync(yamlPath, 'utf8')) as { paths?: Record<string, unknown> }
    const specPaths = spec.paths ?? {}

    // Expected folders (all intermediate levels) and expected files
    const expectedFolders = new Set<string>()
    const expectedFiles = new Set<string>()

    for (const route of Object.keys(specPaths)) {
      const segments = routeToSegments(route)

      // Every intermediate folder
      for (let i = 1; i <= segments.length; i++) {
        expectedFolders.add(path.join(outDir, ...segments.slice(0, i)))
      }

      const leafDir = path.join(outDir, ...segments)
      expectedFiles.add(path.join(leafDir, 'types.ts'))
      expectedFiles.add(path.join(leafDir, 'index.ts'))
    }

    // The utils/ directory and its two fixed files are always expected
    const utilsDir = path.join(outDir, 'utils')
    expectedFolders.add(utilsDir)
    expectedFiles.add(path.join(utilsDir, 'openapi.yaml'))
    expectedFiles.add(path.join(utilsDir, 'openapi.types.ts'))

    // -----------------------------------------------------------------------
    // 2. Walk actual tree
    // -----------------------------------------------------------------------
    const actual = walkAll(outDir)

    const issues: Array<{ kind: 'unexpected' | 'missing'; item: string }> = []

    // Unexpected
    for (const item of actual) {
      const isDir = statSync(item).isDirectory()
      if (isDir) {
        if (!expectedFolders.has(item) && item !== outDir) {
          issues.push({ kind: 'unexpected', item })
        }
      } else {
        if (!expectedFiles.has(item)) {
          issues.push({ kind: 'unexpected', item })
        }
      }
    }

    // Missing
    for (const f of [...expectedFolders, ...expectedFiles]) {
      if (!existsSync(f)) {
        issues.push({ kind: 'missing', item: f })
      }
    }

    // -----------------------------------------------------------------------
    // 3. Output
    // -----------------------------------------------------------------------
    if (issues.length === 0) {
      process.stdout.write('No issues found.\n')
      process.exit(0)
    }

    const colorize = (s: string, kind: 'unexpected' | 'missing') => {
      if (!isTTY) return s
      return kind === 'unexpected' ? `\x1b[31m${s}\x1b[0m` : `\x1b[33m${s}\x1b[0m`
    }

    let errors = 0
    let warnings = 0

    for (const { kind, item } of issues) {
      const rel = path.relative(root, item)
      if (kind === 'unexpected') {
        process.stdout.write(colorize(`${rel}: error: unexpected file/folder (not in OpenAPI spec)`, kind) + '\n')
        errors++
      } else {
        process.stdout.write(colorize(`${rel}: warning: expected by spec but not found — run \`dude api sync\``, kind) + '\n')
        warnings++
      }
    }

    const summary = [
      errors > 0 ? `${errors} error${errors > 1 ? 's' : ''}` : '',
      warnings > 0 ? `${warnings} warning${warnings > 1 ? 's' : ''}` : '',
    ]
      .filter(Boolean)
      .join(', ')

    process.stderr.write(`\n${summary}\n`)
    process.exit(errors > 0 ? 1 : 0)
  },
})
