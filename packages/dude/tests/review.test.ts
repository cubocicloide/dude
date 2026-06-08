/**
 * User journey: `dude review`
 *
 * `dude review` runs three sections in sequence:
 *   1. dude lint   — custom structural checks (no external tools needed)
 *   2. ESLint      — TypeScript linting via pnpm (skipped with warning if pnpm missing)
 *   3. api review  — OpenAPI contract check (requires dude api sync to have been run first)
 *
 * This test walks through each section so you can see exactly what runs:
 *   1. Clean scaffold → lint passes, api review fails (BUG-001: openapi.yaml not yet generated)
 *   2. Introduce a lint violation → dude review catches it in the lint section
 *   3. Fix the violation → lint section passes, api review still documents BUG-001
 *
 * Known limitation (BUG-001):
 *   `dude api review` requires `frontend/src/openapi/utils/openapi.yaml` which is only
 *   generated after running `dude api sync` against a live backend. On a fresh scaffold
 *   this file does not exist, so `dude review` always exits 1 due to the api review step.
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
const PROJECT_DIR = resolve(REPO_ROOT, 'private/examples/test-review')

function isAvailable(cmd: string): boolean {
  return spawnSync(cmd, ['--version'], { stdio: 'ignore', shell: true }).error == null
}

function review() {
  return spawnSync('node', [DUDE_BIN, 'review'], {
    cwd: PROJECT_DIR,
    encoding: 'utf8',
    stdio: 'pipe',
  })
}

const pnpmAvailable = isAvailable('pnpm')

describe('dude review — user journey', () => {
  beforeAll(() => {
    step('Scaffolding test project…')
    if (existsSync(PROJECT_DIR)) rmSync(PROJECT_DIR, { recursive: true, force: true })

    const result = spawnSync(
      'node',
      [DUDE_BIN, 'init', '--stack', './stacks/react-fastapi', '--yes', PROJECT_DIR],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe' },
    )
    process.stdout.write(`   → Project created at: ${PROJECT_DIR}\n`)
    process.stdout.write(`\n   Tool availability:\n`)
    process.stdout.write(`     pnpm : ${pnpmAvailable ? '✓ found — ESLint section will run' : '✗ not found — ESLint section will be skipped with warning'}\n`)
    process.stdout.write(`\n   Known limitation (BUG-001):\n`)
    process.stdout.write(`     api review requires openapi.yaml which does not exist on a fresh scaffold.\n`)
    process.stdout.write(`     Run 'dude api sync' against a live backend to generate it first.\n`)

    if (result.status !== 0) process.stdout.write(`   ⚠ init stderr: ${result.stderr}\n`)
  }, 60_000)

  // ── 1. Baseline ──────────────────────────────────────────────────────────────

  it('clean scaffold: lint section passes, api review fails (BUG-001)', () => {
    step('Running dude review on clean scaffold…')
    const result = review()
    const output = result.stdout + result.stderr
    logOutput(output)
    process.stdout.write(`   → Exit code: ${result.status}\n`)

    // lint section always runs and should be clean
    expect(output).toContain('dude lint')

    // api review fails because openapi.yaml does not exist yet (BUG-001)
    expect(output).toContain('api review')
    expect(result.status).toBe(1)

    process.stdout.write('\n   ℹ  Exit 1 is expected here due to BUG-001 (missing openapi.yaml)\n')
  })

  it('lint section always runs regardless of pnpm availability', () => {
    step('Verifying lint section runs before ESLint…')
    const result = review()
    const output = result.stdout + result.stderr

    // lint section header must appear
    expect(output).toContain('dude lint')

    if (!pnpmAvailable) {
      // pnpm missing → ESLint sections show warning instead of hard exit
      expect(output).toContain('warning:')
      process.stdout.write('   ℹ  pnpm not found — ESLint section correctly shows warning (BUG-004 was fixed)\n')
    } else {
      process.stdout.write('   ℹ  pnpm found — ESLint section ran\n')
    }
  })

  // ── 2 & 3. Lint violation caught by review ───────────────────────────────────

  it('review catches a FE001 violation in the lint section', () => {
    const badDir = join(PROJECT_DIR, 'frontend', 'src', 'components', 'mywidget')
    step(`Injecting FE001 violation — creating: ${badDir}`)
    mkdirSync(badDir, { recursive: true })

    const result = review()
    const output = result.stdout + result.stderr
    logOutput(output)
    process.stdout.write(`   → Exit code: ${result.status}\n`)

    expect(output).toContain('FE001')
    expect(result.status).toBe(1)
  })

  it('after fixing the violation the lint section is clean', () => {
    const badDir = join(PROJECT_DIR, 'frontend', 'src', 'components', 'mywidget')
    step('Fixing FE001 — removing the lowercase component directory…')
    if (existsSync(badDir)) rmSync(badDir, { recursive: true, force: true })

    const result = review()
    const output = result.stdout + result.stderr
    logOutput(output)
    process.stdout.write(`   → Exit code: ${result.status} (1 expected — BUG-001 still present)\n`)

    // lint section should be clean now
    expect(output).not.toContain('FE001')
    // overall still fails due to BUG-001
    expect(result.status).toBe(1)
  })

  it('api review section documents BUG-001: fails without openapi.yaml', () => {
    step('Demonstrating BUG-001 — api review requires prior dude api sync…')
    const openapiPath = join(PROJECT_DIR, 'frontend', 'src', 'openapi', 'utils', 'openapi.yaml')

    process.stdout.write(`   → Checking for openapi.yaml at: ${openapiPath}\n`)
    process.stdout.write(`   → Exists: ${existsSync(openapiPath)}\n`)
    process.stdout.write('   → To fix: run "dude api sync" against a live backend first\n')

    const result = review()
    const output = result.stdout + result.stderr
    logOutput(output)

    expect(output).toContain('api review')
    expect(result.status).toBe(1)
  })

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  it('cleanup — inspect files then confirm deletion', async () => {
    await confirmAndCleanup(PROJECT_DIR)
  }, 300_000)
})
