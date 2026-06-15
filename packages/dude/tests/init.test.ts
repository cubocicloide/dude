/**
 * Integration test: `dude init`.
 *
 * Steps tested:
 * - Scaffolds a new project into a temp directory using the local react-fastapi stack
 * - Exits 0 with no errors
 * - Creates the expected directory structure (backend/, frontend/, e2e/)
 * - Writes a valid dude.json manifest
 * - Produces a .gitignore and docker-compose.yml
 * - Runs the freshly-scaffolded project's OWN test suite (backend pytest, via
 *   `dude test --backend`) to prove the generated project is healthy, not just
 *   structurally present. Skipped automatically when `uv` is not installed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../..') // monorepo root
const DUDE_BIN = resolve(REPO_ROOT, 'packages/dude/bin/dude.mjs')
const PROJECT_NAME = 'dude-init-test'

// The backend suite runs through `uv`; skip that step gracefully where it is
// absent (e.g. a dev machine without uv) instead of hard-failing.
const UV_AVAILABLE = spawnSync('uv', ['--version'], { stdio: 'ignore' }).error == null

let tempDir: string
let projectDir: string
let initResult: ReturnType<typeof spawnSync>

describe('dude init', () => {
  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'dude-init-'))
    projectDir = join(tempDir, PROJECT_NAME)

    // Pass the absolute path as the positional dir argument so the project
    // lands in our temp dir rather than in the repo root.
    initResult = spawnSync(
      'node',
      [DUDE_BIN, 'init', '--stack', './stacks/react-fastapi', '--yes', projectDir],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe' },
    )
  }, 60000)

  afterAll(() => {
    if (tempDir && existsSync(tempDir)) rmSync(tempDir, { recursive: true, force: true })
  })

  // ── Process outcome ─────────────────────────────────────────────────────────

  it('exits 0', () => {
    expect(initResult.status).toBe(0)
  })

  it('prints no error output', () => {
    expect(initResult.stderr).not.toMatch(/^(ERROR|ERR_|error:)/m)
  })

  // ── Directory structure ──────────────────────────────────────────────────────

  it('creates the project directory', () => {
    expect(existsSync(projectDir)).toBe(true)
  })

  it('creates a backend/ directory', () => {
    expect(existsSync(join(projectDir, 'backend'))).toBe(true)
  })

  it('creates a frontend/ directory', () => {
    expect(existsSync(join(projectDir, 'frontend'))).toBe(true)
  })

  it('creates an e2e/ directory', () => {
    expect(existsSync(join(projectDir, 'e2e'))).toBe(true)
  })

  it('creates a docker-compose.yml', () => {
    expect(existsSync(join(projectDir, 'docker-compose.yml'))).toBe(true)
  })

  it('creates a .gitignore', () => {
    expect(existsSync(join(projectDir, '.gitignore'))).toBe(true)
  })

  // ── dude.json manifest ───────────────────────────────────────────────────────

  it('writes a dude.json manifest', () => {
    expect(existsSync(join(projectDir, 'dude.json'))).toBe(true)
  })

  it('dude.json records the correct stack name', () => {
    const manifest = JSON.parse(readFileSync(join(projectDir, 'dude.json'), 'utf8'))
    expect(manifest.stack).toBe('@cubocicloide/stack-react-fastapi')
  })

  it('dude.json records a projectName in answers', () => {
    const manifest = JSON.parse(readFileSync(join(projectDir, 'dude.json'), 'utf8'))
    // --yes uses the stack's default ('my-app'); projectName is always a non-empty string
    expect(typeof manifest.answers.projectName).toBe('string')
    expect(manifest.answers.projectName.length).toBeGreaterThan(0)
  })

  it('dude.json has a valid stackVersion and dudeVersion', () => {
    const manifest = JSON.parse(readFileSync(join(projectDir, 'dude.json'), 'utf8'))
    expect(manifest.stackVersion).toMatch(/^\d+\.\d+\.\d+/)
    expect(manifest.dudeVersion).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('dude.json has a valid generatedAt timestamp', () => {
    const manifest = JSON.parse(readFileSync(join(projectDir, 'dude.json'), 'utf8'))
    expect(() => new Date(manifest.generatedAt)).not.toThrow()
    expect(new Date(manifest.generatedAt).getFullYear()).toBeGreaterThanOrEqual(2024)
  })

  // ── Project test suite ───────────────────────────────────────────────────────
  //
  // Drive the generated project exactly as a user would: `dude test --backend`
  // runs `uv run pytest` inside the scaffolded backend/. This proves the new
  // project's own tests pass, not merely that the files exist. (e2e is left out —
  // it needs a running app + browsers, which is out of scope for this test.)

  it.skipIf(!UV_AVAILABLE)(
    "runs the scaffolded project's backend test suite (dude test --backend)",
    () => {
      const result = spawnSync('node', [DUDE_BIN, 'test', '--backend'], {
        cwd: projectDir,
        encoding: 'utf8',
        stdio: 'pipe',
      })

      // Surface the project's test output when something goes wrong.
      if (result.status !== 0) {
        process.stdout.write((result.stdout ?? '') + '\n')
        process.stderr.write((result.stderr ?? '') + '\n')
      }

      expect(result.status).toBe(0)
      expect(result.stdout).toMatch(/All tests passed\./)
    },
    300_000,
  )
})
