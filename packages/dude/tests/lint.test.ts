/**
 * User journey: `dude lint`
 *
 * Covers every lint check (BE001–BE011, FE001–FE008, E2E001–E2E007) with at
 * least one violation fixture and a corresponding fix, demonstrating the full
 * lifecycle a developer would experience when fixing lint issues.
 *
 * Structure per check:
 *   - Error checks: two tests — violation (exits 1) + fix (exits 0)
 *   - Warning checks: one combined test — creates fixture, asserts warning
 *     with exit 0, removes fixture, asserts clean
 *
 * At the end you are asked whether to delete the test project.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { step, logOutput, confirmAndCleanup } from './helpers.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '../../..')
const DUDE_BIN = resolve(REPO_ROOT, 'packages/dude/bin/dude.mjs')
const PROJECT_DIR = resolve(REPO_ROOT, 'private/examples/test-lint')

// ── Helpers ──────────────────────────────────────────────────────────────────

function lint(args: string[] = []) {
  return spawnSync('node', [DUDE_BIN, 'lint', ...args], {
    cwd: PROJECT_DIR,
    encoding: 'utf8',
    stdio: 'pipe',
  })
}

function p(...parts: string[]) {
  return join(PROJECT_DIR, ...parts)
}

function assertViolation(code: string, result: ReturnType<typeof lint>) {
  logOutput(result.stdout + result.stderr)
  process.stdout.write(`   → Exit code: ${result.status}\n`)
  expect(result.stdout + result.stderr).toContain(code)
  expect(result.status).toBe(1)
}

function assertWarning(code: string, result: ReturnType<typeof lint>) {
  logOutput(result.stdout + result.stderr)
  process.stdout.write(`   → Exit code: ${result.status} (0 = warnings only)\n`)
  expect(result.stdout + result.stderr).toContain(code)
  expect(result.status).toBe(0)
}

function assertClean(result: ReturnType<typeof lint>) {
  logOutput(result.stdout + result.stderr)
  process.stdout.write(`   → Exit code: ${result.status}\n`)
  expect(result.status).toBe(0)
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('dude lint — user journey', () => {
  beforeAll(() => {
    step('Scaffolding test project…')
    if (existsSync(PROJECT_DIR)) rmSync(PROJECT_DIR, { recursive: true, force: true })

    const result = spawnSync(
      'node',
      [DUDE_BIN, 'init', '--stack', './stacks/react-fastapi', '--yes', PROJECT_DIR],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: 'pipe' },
    )
    process.stdout.write(`   → Project created at: ${PROJECT_DIR}\n`)
    if (result.status !== 0) process.stdout.write(`   ⚠ init stderr: ${result.stderr}\n`)
  }, 60_000)

  // ── Baseline ─────────────────────────────────────────────────────────────

  it('baseline: clean scaffold exits 0 — all checks pass on a fresh project', () => {
    step('Running lint on the clean scaffold…')
    assertClean(lint())
  })

  it('baseline: --quiet produces no rule codes on a clean scaffold', () => {
    step('Running lint --quiet (suppresses warning diagnostics)…')
    const result = lint(['--quiet'])
    const output = (result.stdout + result.stderr).trim()
    process.stdout.write(`   → Output: ${output || '(empty)'}\n`)
    expect(result.status).toBe(0)
    expect(output).not.toMatch(/[A-Z]{2}\d{3}/)
  })

  // ══════════════════════════════════════════════════════════════════════════
  // BE checks
  // ══════════════════════════════════════════════════════════════════════════

  // ── BE001: required directory structure ───────────────────────────────────

  it('BE001 violation: exits 1 when a required backend/app/ directory is missing', () => {
    const fixturesDir = p('backend', 'app', 'fixtures')
    step(`Removing required directory to trigger BE001: ${fixturesDir}`)
    renameSync(fixturesDir, fixturesDir + '.bak')

    assertViolation('BE001', lint())
  })

  it('BE001 fix: exits 0 after restoring the missing directory', () => {
    const fixturesDir = p('backend', 'app', 'fixtures')
    step('Restoring backend/app/fixtures/ …')
    renameSync(fixturesDir + '.bak', fixturesDir)

    assertClean(lint())
  })

  // ── BE002: model file must define class matching filename ──────────────────

  it('BE002 violation: exits 1 when a model file has no matching class', () => {
    const file = p('backend', 'app', 'models', 'widget.py')
    step(`Injecting BE002 violation → ${file}`)
    writeFileSync(file, '# empty — missing Widget class\n')

    assertViolation('BE002', lint())
  })

  it('BE002 fix: exits 0 after adding the required class to the model file', () => {
    const file = p('backend', 'app', 'models', 'widget.py')
    step('Fixing BE002 — adding `class Widget` …')
    writeFileSync(file, 'class Widget:\n    """Widget model."""\n    pass\n')

    const result = lint()
    logOutput(result.stdout + result.stderr)
    process.stdout.write(`   → Exit code: ${result.status}\n`)
    expect(result.stdout + result.stderr).not.toContain('BE002')
    expect(result.status).toBe(0)

    rmSync(file)
  })

  // ── BE003: schema classes must extend BaseModel/SQLModel + correct prefix ──

  it('BE003 violation: exits 1 when schema class does not extend BaseModel or has wrong name', () => {
    const file = p('backend', 'app', 'schemas', 'widget.py')
    step(`Injecting BE003 violation → ${file}`)
    // class doesn't extend BaseModel and name is wrong
    writeFileSync(file, 'class WrongName:\n    pass\n')

    assertViolation('BE003', lint())
  })

  it('BE003 fix: exits 0 after correcting the schema class', () => {
    const file = p('backend', 'app', 'schemas', 'widget.py')
    step('Fixing BE003 — class Widget extends BaseModel with correct name…')
    writeFileSync(file, 'from pydantic import BaseModel\n\n\nclass Widget(BaseModel):\n    pass\n')

    const result = lint()
    logOutput(result.stdout + result.stderr)
    process.stdout.write(`   → Exit code: ${result.status}\n`)
    expect(result.stdout + result.stderr).not.toContain('BE003')
    expect(result.status).toBe(0)

    rmSync(file)
  })

  // ── BE004: router file must define `router = APIRouter(...)` ───────────────

  it('BE004 violation: exits 1 when a router file lacks a router = APIRouter() definition', () => {
    const file = p('backend', 'app', 'routers', 'widget.py')
    step(`Injecting BE004 violation → ${file}`)
    writeFileSync(file, '# router.py without APIRouter — triggers BE004\n')

    assertViolation('BE004', lint())
  })

  it('BE004 fix: exits 0 after adding router = APIRouter()', () => {
    const file = p('backend', 'app', 'routers', 'widget.py')
    step('Fixing BE004 — adding `router = APIRouter()` …')
    writeFileSync(file, 'from fastapi import APIRouter\n\nrouter = APIRouter()\n')

    const result = lint()
    logOutput(result.stdout + result.stderr)
    process.stdout.write(`   → Exit code: ${result.status}\n`)
    expect(result.stdout + result.stderr).not.toContain('BE004')
    expect(result.status).toBe(0)

    rmSync(file)
  })

  // ── BE005: every router must be imported and include_router'd in main.py ───

  it('BE005 warning: exits 0 but warns when a router file is not imported in main.py', () => {
    const file = p('backend', 'app', 'routers', 'orphan.py')
    step(`Injecting BE005 warning fixture → ${file}`)
    writeFileSync(file, 'from fastapi import APIRouter\n\nrouter = APIRouter()\n')

    step('Running lint — expecting BE005 warning (exit 0)…')
    assertWarning('BE005', lint())

    step('Removing orphan router — restoring clean state…')
    rmSync(file)
    assertClean(lint())
  })

  // ── BE006: router filename must be lowercase snake_case ────────────────────

  it('BE006 violation: exits 1 when a router filename is not lowercase snake_case', () => {
    const file = p('backend', 'app', 'routers', 'BadRouter.py')
    step(`Injecting BE006 violation → ${file}`)
    writeFileSync(file, 'from fastapi import APIRouter\n\nrouter = APIRouter()\n')

    assertViolation('BE006', lint())
  })

  it('BE006 fix: exits 0 after removing the badly-named router file', () => {
    const file = p('backend', 'app', 'routers', 'BadRouter.py')
    step('Fixing BE006 — removing the badly-named router file…')
    rmSync(file)

    assertClean(lint())
  })

  // ── BE007: only @router.METHOD-decorated functions are allowed in routers ──

  it('BE007 violation: exits 1 when a router file contains an undecorated function', () => {
    const file = p('backend', 'app', 'routers', 'util_fn.py')
    step(`Injecting BE007 violation → ${file}`)
    writeFileSync(
      file,
      [
        'from fastapi import APIRouter',
        '',
        'router = APIRouter()',
        '',
        'def helper():',
        '    """Not a route handler — triggers BE007."""',
        '    pass',
        '',
      ].join('\n'),
    )

    assertViolation('BE007', lint())
  })

  it('BE007 fix: exits 0 after removing the undecorated function', () => {
    const file = p('backend', 'app', 'routers', 'util_fn.py')
    step('Fixing BE007 — removing the undecorated helper function…')
    rmSync(file)

    assertClean(lint())
  })

  // ── BE008: every source file should have a corresponding test ──────────────

  it('BE008 warning: exits 0 but warns when a source file has no corresponding test file', () => {
    const file = p('backend', 'app', 'models', 'orphan.py')
    step(`Injecting BE008 warning fixture → ${file}`)
    writeFileSync(file, 'class Orphan:\n    pass\n')

    step('Running lint — expecting BE008 warning (exit 0)…')
    assertWarning('BE008', lint())

    step('Removing orphan model — restoring clean state…')
    rmSync(file)
    assertClean(lint())
  })

  // ── BE009: os.getenv / os.environ must only be used in core/ ──────────────

  it('BE009 violation: exits 1 when os.getenv is used outside core/', () => {
    const file = p('backend', 'app', 'routers', 'bad_router.py')
    step(`Injecting BE009 violation → ${file}`)
    writeFileSync(file, 'import os\n\nsecret = os.getenv("SECRET_KEY")\n')

    assertViolation('BE009', lint())
  })

  it('BE009 fix: exits 0 after replacing os.getenv with a settings import', () => {
    const file = p('backend', 'app', 'routers', 'bad_router.py')
    step('Fixing BE009 — using settings from core/config instead…')
    writeFileSync(
      file,
      'from fastapi import APIRouter\nfrom app.core.config import settings\n\nrouter = APIRouter()\n',
    )

    const result = lint()
    logOutput(result.stdout + result.stderr)
    process.stdout.write(`   → Exit code: ${result.status}\n`)
    expect(result.stdout + result.stderr).not.toContain('BE009')
    expect(result.status).toBe(0)

    rmSync(file)
  })

  // ── BE010: model file must define exactly one class ────────────────────────

  it('BE010 violation: exits 1 when a model file defines multiple classes', () => {
    const file = p('backend', 'app', 'models', 'multi.py')
    step(`Injecting BE010 violation → ${file}`)
    // Two classes → BE010; the first matches filename (Multi) so BE002 passes
    writeFileSync(file, 'class Multi:\n    pass\n\n\nclass MultiExtra:\n    pass\n')

    assertViolation('BE010', lint())
  })

  it('BE010 fix: exits 0 after reducing to exactly one class', () => {
    const file = p('backend', 'app', 'models', 'multi.py')
    step('Fixing BE010 — keeping only the primary class…')
    writeFileSync(file, 'class Multi:\n    """Single model class."""\n    pass\n')

    const result = lint()
    logOutput(result.stdout + result.stderr)
    process.stdout.write(`   → Exit code: ${result.status}\n`)
    expect(result.stdout + result.stderr).not.toContain('BE010')
    expect(result.status).toBe(0)

    rmSync(file)
  })

  // ── BE011: queries classes must start with the file's PascalCase prefix ────

  it('BE011 violation: exits 1 when a queries class does not start with the file prefix', () => {
    const file = p('backend', 'app', 'queries', 'things.py')
    step(`Injecting BE011 violation → ${file}`)
    writeFileSync(file, 'class WrongPrefix:\n    pass\n')

    assertViolation('BE011', lint())
  })

  it('BE011 fix: exits 0 after correcting the class name to use the required prefix', () => {
    const file = p('backend', 'app', 'queries', 'things.py')
    step('Fixing BE011 — renaming class to Things (required prefix)…')
    writeFileSync(file, 'class Things:\n    """Query class with correct prefix."""\n    pass\n')

    const result = lint()
    logOutput(result.stdout + result.stderr)
    process.stdout.write(`   → Exit code: ${result.status}\n`)
    expect(result.stdout + result.stderr).not.toContain('BE011')
    expect(result.status).toBe(0)

    rmSync(file)
  })

  // ══════════════════════════════════════════════════════════════════════════
  // FE checks
  // ══════════════════════════════════════════════════════════════════════════

  // ── FE001: component directory names must be PascalCase ───────────────────

  it('FE001 violation: exits 1 when a component directory is not PascalCase', () => {
    const badDir = p('frontend', 'src', 'components', 'badcomponent')
    step(`Injecting FE001 violation — creating: ${badDir}`)
    mkdirSync(badDir, { recursive: true })

    assertViolation('FE001', lint())
  })

  it('FE001 fix: exits 0 after renaming the component directory to PascalCase', () => {
    const badDir = p('frontend', 'src', 'components', 'badcomponent')
    const goodDir = p('frontend', 'src', 'components', 'BadComponent')
    step('Fixing FE001 — renaming badcomponent/ → BadComponent/')
    if (existsSync(badDir)) renameSync(badDir, goodDir)

    const result = lint()
    logOutput(result.stdout + result.stderr)
    process.stdout.write(`   → Exit code: ${result.status}\n`)
    expect(result.stdout + result.stderr).not.toContain('FE001')
    expect(result.status).toBe(0)

    rmSync(goodDir, { recursive: true, force: true })
  })

  // ── FE002: component dirs may only contain allowed files ──────────────────

  it('FE002 warning: exits 0 but warns when a component dir has an unexpected file', () => {
    const helper = p('frontend', 'src', 'components', 'Layout', 'helper.ts')
    step(`Injecting FE002 warning fixture → ${helper}`)
    writeFileSync(helper, '// helper — not allowed in a component dir\n')

    step('Running lint — expecting FE002 warning (exit 0)…')
    assertWarning('FE002', lint())

    step('Removing helper.ts — restoring clean state…')
    rmSync(helper)
    assertClean(lint())
  })

  // ── FE003: components/index.tsx must barrel-export all PascalCase dirs ─────

  it('FE003 violation: exits 1 when components/index.tsx is missing a barrel export', () => {
    const componentsDir = p('frontend', 'src', 'components')
    const barrel = join(componentsDir, 'index.tsx')
    const widgetDir = join(componentsDir, 'NewWidget')
    step(`Injecting FE003 violation — creating barrel + unregistered component`)
    // Barrel exports Layout but not NewWidget
    writeFileSync(barrel, "export { default as Layout } from './Layout'\n")
    mkdirSync(widgetDir, { recursive: true })
    writeFileSync(join(widgetDir, 'index.tsx'), '// NewWidget component\n')

    assertViolation('FE003', lint())
  })

  it('FE003 fix: exits 0 after removing the unregistered component directory', () => {
    const componentsDir = p('frontend', 'src', 'components')
    const widgetDir = join(componentsDir, 'NewWidget')
    const barrel = join(componentsDir, 'index.tsx')
    step('Fixing FE003 — removing the unregistered component dir…')
    rmSync(widgetDir, { recursive: true, force: true })

    const result = lint()
    logOutput(result.stdout + result.stderr)
    process.stdout.write(`   → Exit code: ${result.status}\n`)
    expect(result.stdout + result.stderr).not.toContain('FE003')
    expect(result.status).toBe(0)

    // restore: remove the barrel file (template doesn't have one)
    rmSync(barrel)
  })

  // ── FE004: App.tsx page imports must match pages/ directories ─────────────

  it('FE004 warning: exits 0 but warns when a page directory is not imported in App.tsx', () => {
    const demoDir = p('frontend', 'src', 'pages', 'DemoPage')
    step(`Injecting FE004 warning fixture — creating page dir not in App.tsx: ${demoDir}`)
    mkdirSync(demoDir, { recursive: true })
    writeFileSync(join(demoDir, 'index.tsx'), '// DemoPage — not imported in App.tsx\n')

    step('Running lint — expecting FE004 warning (exit 0)…')
    assertWarning('FE004', lint())

    step('Removing DemoPage dir — restoring clean state…')
    rmSync(demoDir, { recursive: true, force: true })
    assertClean(lint())
  })

  // ── FE005: page dirs may only contain allowed files ───────────────────────

  it('FE005 warning: exits 0 but warns when a page dir has an unexpected file', () => {
    const demoDir = p('frontend', 'src', 'pages', 'DemoPage')
    step(`Injecting FE005 warning fixture — page dir with unexpected file`)
    mkdirSync(demoDir, { recursive: true })
    writeFileSync(join(demoDir, 'index.tsx'), '// DemoPage\n')
    writeFileSync(join(demoDir, 'helper.ts'), '// helper — not allowed in a page dir\n')

    step('Running lint — expecting FE005 warning (exit 0)…')
    assertWarning('FE005', lint())

    step('Removing DemoPage dir — restoring clean state…')
    rmSync(demoDir, { recursive: true, force: true })
    assertClean(lint())
  })

  // ── FE006: hook dirs may only contain allowed files ───────────────────────

  it('FE006 warning: exits 0 but warns when a hook dir has an unexpected file', () => {
    const helper = p('frontend', 'src', 'hooks', 'usePageTitle', 'helper.ts')
    step(`Injecting FE006 warning fixture → ${helper}`)
    writeFileSync(helper, '// helper — not allowed in a hook dir\n')

    step('Running lint — expecting FE006 warning (exit 0)…')
    assertWarning('FE006', lint())

    step('Removing helper.ts — restoring clean state…')
    rmSync(helper)
    assertClean(lint())
  })

  // ── FE007: hooks/index.tsx must barrel-export all use* directories ─────────

  it('FE007 violation: exits 1 when hooks/index.tsx is missing a barrel export for a hook dir', () => {
    const hookDir = p('frontend', 'src', 'hooks', 'useNewHook')
    step(`Injecting FE007 violation — creating hook dir not in barrel: ${hookDir}`)
    mkdirSync(hookDir, { recursive: true })
    writeFileSync(join(hookDir, 'index.tsx'), '// useNewHook — not exported in hooks/index.tsx\n')

    assertViolation('FE007', lint())
  })

  it('FE007 fix: exits 0 after removing the unregistered hook directory', () => {
    const hookDir = p('frontend', 'src', 'hooks', 'useNewHook')
    step('Fixing FE007 — removing the unregistered hook dir…')
    rmSync(hookDir, { recursive: true, force: true })

    const result = lint()
    logOutput(result.stdout + result.stderr)
    process.stdout.write(`   → Exit code: ${result.status}\n`)
    expect(result.stdout + result.stderr).not.toContain('FE007')
    expect(result.status).toBe(0)
  })

  // ── FE008: static assets must live in frontend/src/assets/ ────────────────

  it('FE008 violation: exits 1 when a static asset is found outside frontend/src/assets/', () => {
    const svg = p('frontend', 'src', 'utils', 'logo.svg')
    step(`Injecting FE008 violation — placing asset outside assets/: ${svg}`)
    writeFileSync(svg, '<svg xmlns="http://www.w3.org/2000/svg"/>\n')

    assertViolation('FE008', lint())
  })

  it('FE008 fix: exits 0 after removing the misplaced asset', () => {
    const svg = p('frontend', 'src', 'utils', 'logo.svg')
    step('Fixing FE008 — removing the misplaced SVG…')
    rmSync(svg)

    assertClean(lint())
  })

  // ══════════════════════════════════════════════════════════════════════════
  // E2E checks
  // ══════════════════════════════════════════════════════════════════════════

  // ── E2E001: feature file names must be snake_case ─────────────────────────

  it('E2E001 violation: exits 1 when a feature file name is not snake_case', () => {
    const feature = p('e2e', 'features', 'BadName.feature')
    step(`Injecting E2E001 violation → ${feature}`)
    writeFileSync(feature, 'Feature: bad name\n')

    assertViolation('E2E001', lint())
  })

  it('E2E001 fix: exits 0 after removing the badly-named feature file', () => {
    const feature = p('e2e', 'features', 'BadName.feature')
    step('Fixing E2E001 — removing the badly-named feature file…')
    rmSync(feature)

    assertClean(lint())
  })

  // ── E2E002: every feature file must have a matching steps file ─────────────

  it('E2E002 violation: exits 1 when a feature file has no matching steps file', () => {
    const feature = p('e2e', 'features', 'new_flow.feature')
    step(`Injecting E2E002 violation — feature without steps: ${feature}`)
    writeFileSync(feature, 'Feature: new flow\n  Scenario: placeholder\n    Given nothing\n')

    assertViolation('E2E002', lint())
  })

  it('E2E002 fix: exits 0 after creating the matching steps file', () => {
    const steps = p('e2e', 'steps', 'new_flow.steps.ts')
    step(`Fixing E2E002 — creating matching steps file: ${steps}`)
    writeFileSync(steps, '// Steps for features/new_flow.feature\n')

    const result = lint()
    logOutput(result.stdout + result.stderr)
    process.stdout.write(`   → Exit code: ${result.status}\n`)
    expect(result.stdout + result.stderr).not.toContain('E2E002')
    expect(result.status).toBe(0)

    // cleanup both fixtures
    rmSync(p('e2e', 'features', 'new_flow.feature'))
    rmSync(steps)
  })

  // ── E2E003: steps files must have a matching feature file ─────────────────

  it('E2E003 violation: exits 1 when a steps file has no matching feature file', () => {
    const steps = p('e2e', 'steps', 'orphan.steps.ts')
    step(`Injecting E2E003 violation — orphan steps file: ${steps}`)
    writeFileSync(steps, '// orphan — no matching orphan.feature\n')

    assertViolation('E2E003', lint())
  })

  it('E2E003 fix: exits 0 after removing the orphan steps file', () => {
    const steps = p('e2e', 'steps', 'orphan.steps.ts')
    step('Fixing E2E003 — removing the orphan steps file…')
    rmSync(steps)

    assertClean(lint())
  })

  // ── E2E004: page object files must follow *Page.ts naming ─────────────────

  it('E2E004 violation: exits 1 when a page object file does not follow *Page.ts naming', () => {
    const helper = p('e2e', 'pages', 'helper.ts')
    step(`Injecting E2E004 violation — page object with wrong name: ${helper}`)
    writeFileSync(helper, 'export class Helper {}\n')

    assertViolation('E2E004', lint())
  })

  it('E2E004 fix: exits 0 after removing the badly-named page object', () => {
    const helper = p('e2e', 'pages', 'helper.ts')
    step('Fixing E2E004 — removing the badly-named page object…')
    rmSync(helper)

    assertClean(lint())
  })

  // ── E2E005: page objects imported in steps must exist in e2e/pages/ ────────

  it('E2E005 violation: exits 1 when a steps file imports a non-existent page object', () => {
    const feature = p('e2e', 'features', 'widget.feature')
    const steps = p('e2e', 'steps', 'widget.steps.ts')
    step(`Injecting E2E005 violation — steps importing missing page`)
    writeFileSync(feature, 'Feature: widget\n')
    writeFileSync(
      steps,
      "import { MissingPage } from '../pages/MissingPage'\n// step using MissingPage\n",
    )

    assertViolation('E2E005', lint())
  })

  it('E2E005 fix: exits 0 after creating the missing page object', () => {
    const page = p('e2e', 'pages', 'MissingPage.ts')
    step(`Fixing E2E005 — creating the missing page object: ${page}`)
    writeFileSync(page, 'export class MissingPage {}\n')

    const result = lint()
    logOutput(result.stdout + result.stderr)
    process.stdout.write(`   → Exit code: ${result.status}\n`)
    expect(result.stdout + result.stderr).not.toContain('E2E005')
    expect(result.status).toBe(0)

    rmSync(p('e2e', 'features', 'widget.feature'))
    rmSync(p('e2e', 'steps', 'widget.steps.ts'))
    rmSync(page)
  })

  // ── E2E006: playwright.config.ts and cucumber.js must exist ───────────────

  it('E2E006 violation: exits 1 when a required e2e config file is missing', () => {
    const config = p('e2e', 'playwright.config.ts')
    step('Injecting E2E006 violation — temporarily renaming playwright.config.ts…')
    renameSync(config, config + '.bak')

    assertViolation('E2E006', lint())
  })

  it('E2E006 fix: exits 0 after restoring the config file', () => {
    const config = p('e2e', 'playwright.config.ts')
    step('Fixing E2E006 — restoring playwright.config.ts…')
    renameSync(config + '.bak', config)

    assertClean(lint())
  })

  // ── E2E007: step files must not contain hardcoded URLs ────────────────────

  it('E2E007 warning: exits 0 but warns when a steps file contains a hardcoded URL', () => {
    const feature = p('e2e', 'features', 'url_check.feature')
    const steps = p('e2e', 'steps', 'url_check.steps.ts')
    step(`Injecting E2E007 warning fixture — steps with hardcoded URL`)
    writeFileSync(feature, 'Feature: url check\n')
    writeFileSync(
      steps,
      "// Use this.baseUrl instead of hardcoded URLs\nconst url = 'http://localhost:8000/api'\n",
    )

    step('Running lint — expecting E2E007 warning (exit 0)…')
    assertWarning('E2E007', lint())

    step('Removing fixtures — restoring clean state…')
    rmSync(feature)
    rmSync(steps)
    assertClean(lint())
  })

  // ── Cleanup ───────────────────────────────────────────────────────────────

  it('cleanup — inspect files then confirm deletion', async () => {
    await confirmAndCleanup(PROJECT_DIR)
  }, 300_000)
})
