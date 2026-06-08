/**
 * User journey: `dude format`
 *
 * Walks through the format lifecycle as a developer would experience it:
 *   1. Scaffold + sync deps so ruff and prettier are ready
 *   2. Pre-format the project once (template has minor prettier style drift)
 *   3. Introduce a badly-formatted Python file → format --check catches it
 *   4. Fix the file → format --check passes
 *   5. Introduce a badly-formatted TypeScript file → format --check catches it
 *   6. Fix the file → format --check passes
 *
 * Tools required:
 *   uv   — for ruff (Python formatting).  Needs `uv sync` in backend/ first.
 *   pnpm — for prettier (TypeScript formatting).
 *
 * Each section is skipped gracefully if the required tool is not available.
 *
 * At the end you are asked whether to delete the test project.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { step, logOutput, confirmAndCleanup } from './helpers.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../..')
const DUDE_BIN = resolve(REPO_ROOT, 'packages/dude/bin/dude.mjs')
const PROJECT_DIR = resolve(REPO_ROOT, 'private/examples/test-format')

function isAvailable(cmd: string): boolean {
  return spawnSync(cmd, ['--version'], { stdio: 'ignore', shell: true }).error == null
}

function isRuffAvailable(): boolean {
  const r = spawnSync('uv', ['run', 'ruff', '--version'], {
    cwd: join(PROJECT_DIR, 'backend'),
    stdio: 'ignore',
    shell: true,
  })
  return r.status === 0
}

function format(args: string[] = []) {
  return spawnSync('node', [DUDE_BIN, 'format', ...args], {
    cwd: PROJECT_DIR,
    encoding: 'utf8',
    stdio: 'pipe',
  })
}

let ruffAvailable = false
let pnpmAvailable = false

describe('dude format — user journey', () => {
  beforeAll(() => {
    step('Scaffolding test project…')
    try {
      if (existsSync(PROJECT_DIR)) rmSync(PROJECT_DIR, { recursive: true, force: true })
    } catch {
      // .venv or node_modules may be locked by a previous run; scaffold fresh next to it
      process.stdout.write('   ⚠ Could not remove previous directory (files locked) — reusing it\n')
    }

    spawnSync(
      'node',
      [DUDE_BIN, 'init', '--stack', './stacks/react-fastapi', '--yes', PROJECT_DIR],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe' },
    )
    process.stdout.write(`   → Project created at: ${PROJECT_DIR}\n`)

    // Sync backend deps so `uv run ruff` works
    if (isAvailable('uv')) {
      step('Running uv sync in backend/ to install ruff…')
      const sync = spawnSync('uv', ['sync'], {
        cwd: join(PROJECT_DIR, 'backend'),
        encoding: 'utf8',
        stdio: 'pipe',
        shell: true,
      })
      if (sync.status === 0) {
        process.stdout.write('   → uv sync complete\n')
      } else {
        process.stdout.write(`   ⚠ uv sync failed: ${sync.stderr}\n`)
      }
    }

    ruffAvailable = isRuffAvailable()
    pnpmAvailable = isAvailable('pnpm')

    process.stdout.write(`\n   Tool availability:\n`)
    process.stdout.write(`     ruff (via uv run) : ${ruffAvailable ? '✓ found' : '✗ not found — Python sections will be skipped'}\n`)
    process.stdout.write(`     pnpm              : ${pnpmAvailable ? '✓ found' : '✗ not found — TypeScript sections will be skipped'}\n`)

    // Pre-format the project once so the baseline is clean before fixture tests
    if (ruffAvailable || pnpmAvailable) {
      step('Pre-formatting project to establish a clean baseline…')
      const result = format()
      logOutput(result.stdout + result.stderr)
      process.stdout.write(`   → Exit code: ${result.status}\n`)
    }
  }, 180_000)

  // ── 1. Baseline ──────────────────────────────────────────────────────────────

  it('format --check exits 0 on a pre-formatted project', () => {
    if (!ruffAvailable && !pnpmAvailable) {
      process.stdout.write('   ⚠  Skipping — neither ruff nor pnpm available\n')
      return
    }
    step('Running format --check on the pre-formatted project…')
    const result = format(['--check'])
    logOutput(result.stdout + result.stderr)
    process.stdout.write(`   → Exit code: ${result.status}\n`)
    expect(result.status).toBe(0)
  })

  // ── 2 & 3. Python formatting (ruff) ──────────────────────────────────────────

  it('Python violation: format --check exits 1 on a badly formatted .py file', () => {
    if (!ruffAvailable) {
      process.stdout.write('   ⚠  Skipping — ruff not available via uv\n')
      return
    }

    const fixturePath = join(PROJECT_DIR, 'backend', 'app', 'utils', 'calculator.py')
    step(`Injecting badly formatted Python → ${fixturePath}`)
    // ruff format requires spaces around operators and after commas
    writeFileSync(fixturePath, 'def add(a,b):\n    return a+b\ndef subtract(a,b):\n    return a-b\n')
    process.stdout.write('   → Content: def add(a,b): / return a+b  (missing spaces)\n')

    const result = format(['--check'])
    logOutput(result.stdout + result.stderr)
    process.stdout.write(`   → Exit code: ${result.status}\n`)
    expect(result.status).toBe(1)
  })

  it('Python fix: format --check exits 0 after correcting the spacing', () => {
    if (!ruffAvailable) {
      process.stdout.write('   ⚠  Skipping — ruff not available via uv\n')
      return
    }

    const fixturePath = join(PROJECT_DIR, 'backend', 'app', 'utils', 'calculator.py')
    step('Fixing Python formatting — adding proper spaces…')
    writeFileSync(fixturePath, 'def add(a, b):\n    return a + b\n\n\ndef subtract(a, b):\n    return a - b\n')
    process.stdout.write('   → Content: def add(a, b): / return a + b  (corrected)\n')

    const result = format(['--check'])
    logOutput(result.stdout + result.stderr)
    process.stdout.write(`   → Exit code: ${result.status}\n`)
    expect(result.status).toBe(0)
  })

  // ── 4 & 5. TypeScript formatting (prettier) ───────────────────────────────────

  it('TypeScript violation: format --check exits 1 on a badly formatted .ts file', () => {
    if (!pnpmAvailable) {
      process.stdout.write('   ⚠  Skipping — pnpm not available\n')
      return
    }

    const fixtureDir = join(PROJECT_DIR, 'frontend', 'src', 'utils')
    const fixturePath = join(fixtureDir, 'greet.ts')
    mkdirSync(fixtureDir, { recursive: true })
    step(`Injecting badly formatted TypeScript → ${fixturePath}`)
    // prettier enforces: spaces around operators, proper indentation (singleQuote:true, semi:false)
    writeFileSync(fixturePath, "export const greet=(name:string)=>{\nreturn 'Hello '+name\n}\n")
    process.stdout.write("   → Content: greet=(name:string)=>{  (missing spaces, bad indentation)\n")

    const result = format(['--check'])
    logOutput(result.stdout + result.stderr)
    process.stdout.write(`   → Exit code: ${result.status}\n`)
    expect(result.status).toBe(1)
  })

  it('TypeScript fix: format --check exits 0 after correcting the style', () => {
    if (!pnpmAvailable) {
      process.stdout.write('   ⚠  Skipping — pnpm not available\n')
      return
    }

    const fixturePath = join(PROJECT_DIR, 'frontend', 'src', 'utils', 'greet.ts')
    step('Fixing TypeScript formatting — rewriting with correct style…')
    // singleQuote: true, semi: false, tabWidth: 2 (matches template .prettierrc.json)
    writeFileSync(fixturePath, "export const greet = (name: string) => {\n  return 'Hello ' + name\n}\n")
    process.stdout.write("   → Content: greet = (name: string) => {  (corrected: single quotes, no semicolons)\n")

    const result = format(['--check'])
    logOutput(result.stdout + result.stderr)
    process.stdout.write(`   → Exit code: ${result.status}\n`)
    expect(result.status).toBe(0)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  it('cleanup — inspect files then confirm deletion', async () => {
    await confirmAndCleanup(PROJECT_DIR)
  }, 300_000)
})
