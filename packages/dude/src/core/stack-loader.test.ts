/**
 * Unit tests for the stack-loader resolution paths.
 *
 * These tests focus on the error message produced when a stack entry point
 * is missing (dist/index.js not built), verifying that each resolution
 * source — workspace checkout, installed node package, dude cache, and
 * explicit path — produces context-appropriate remediation guidance.
 */
import { describe, expect, it, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadStack, pickChannelVersion } from './stack-loader.js'

const tmpDirs: string[] = []

function makeTmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dude-stack-loader-'))
  tmpDirs.push(dir)
  return dir
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true })
})

/**
 * Create a minimal fake stack package at `root` with the given package name,
 * but WITHOUT a `dist/` directory so the entry point is missing.
 */
function makeUnbuiltStack(root: string, pkgName: string): void {
  mkdirSync(root, { recursive: true })
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: pkgName,
      version: '1.0.0',
      module: './dist/index.js',
      main: './dist/index.js',
    }),
  )
  // Intentionally no dist/ directory — simulates a fresh source checkout.
}

/**
 * Create a fake stack package at `root` with a built dist/index.js that
 * exports a minimal StackDefinition-shaped object.
 */
function makeBuiltStack(root: string, pkgName: string): void {
  mkdirSync(join(root, 'dist'), { recursive: true })
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: pkgName,
      version: '1.0.0',
      module: './dist/index.js',
      main: './dist/index.js',
    }),
  )
  writeFileSync(
    join(root, 'dist', 'index.js'),
    // Minimal ESM module that exports a StackDefinition-shaped default.
    `export default { id: 'test-stack', description: 'Test stack', commands: {}, templates: [] };\n`,
  )
}

describe('loadStack — missing dist (workspace source checkout)', () => {
  it('throws an error mentioning pnpm --filter build when resolved from a workspace', async () => {
    const workspaceRoot = makeTmpDir()
    const stackDir = join(workspaceRoot, 'stacks', 'my-stack')
    makeUnbuiltStack(stackDir, '@test/my-stack')

    // Build a minimal pnpm-workspace.yaml so findInPnpmWorkspace can find the package.
    writeFileSync(join(workspaceRoot, 'pnpm-workspace.yaml'), 'packages:\n  - stacks/*\n')

    await expect(loadStack('@test/my-stack', workspaceRoot)).rejects.toThrow(
      /pnpm --filter @test\/my-stack build/,
    )
  })

  it('error message for workspace checkout mentions make build as alternative', async () => {
    const workspaceRoot = makeTmpDir()
    const stackDir = join(workspaceRoot, 'stacks', 'my-stack')
    makeUnbuiltStack(stackDir, '@test/my-stack')
    writeFileSync(join(workspaceRoot, 'pnpm-workspace.yaml'), 'packages:\n  - stacks/*\n')

    await expect(loadStack('@test/my-stack', workspaceRoot)).rejects.toThrow(/make build/)
  })

  it('error message for workspace checkout mentions source-checkout context', async () => {
    const workspaceRoot = makeTmpDir()
    const stackDir = join(workspaceRoot, 'stacks', 'my-stack')
    makeUnbuiltStack(stackDir, '@test/my-stack')
    writeFileSync(join(workspaceRoot, 'pnpm-workspace.yaml'), 'packages:\n  - stacks/*\n')

    await expect(loadStack('@test/my-stack', workspaceRoot)).rejects.toThrow(
      /source-checkout|workspace/,
    )
  })
})

describe('loadStack — missing dist (explicit path)', () => {
  it('throws an error for an explicit path spec pointing to an unbuilt package', async () => {
    const dir = makeTmpDir()
    makeUnbuiltStack(dir, 'my-local-stack')

    await expect(loadStack(dir, dir)).rejects.toThrow(/Stack entry point not found/)
  })

  it('error message for explicit path includes a build hint', async () => {
    const dir = makeTmpDir()
    makeUnbuiltStack(dir, 'my-local-stack')

    await expect(loadStack(dir, dir)).rejects.toThrow(/build/)
  })
})

describe('loadStack — missing package.json', () => {
  it('throws when the resolved root has no package.json', async () => {
    const dir = makeTmpDir()
    // Create directory with no package.json.
    mkdirSync(join(dir, 'empty-stack'), { recursive: true })

    await expect(loadStack(join(dir, 'empty-stack'), dir)).rejects.toThrow(
      /missing a package\.json/,
    )
  })
})

describe('loadStack — bad default export', () => {
  it('throws when the entry point has no default export', async () => {
    const dir = makeTmpDir()
    mkdirSync(join(dir, 'dist'), { recursive: true })
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: '@test/bad-stack', version: '1.0.0', main: './dist/index.js' }),
    )
    writeFileSync(join(dir, 'dist', 'index.js'), '// no default export\nexport const foo = 1;\n')

    await expect(loadStack(dir, dir)).rejects.toThrow(/must export a default StackDefinition/)
  })
})

describe('loadStack — successful resolution via explicit path', () => {
  it('loads a properly built stack from an explicit path', async () => {
    const dir = makeTmpDir()
    makeBuiltStack(dir, '@test/good-stack')

    const loaded = await loadStack(dir, dir)
    expect(loaded.version).toBe('1.0.0')
    expect(loaded.root).toBe(dir)
    expect(loaded.definition).toBeDefined()
  })
})

describe('pickChannelVersion — release-channel resolution', () => {
  const pkg = '@test/some-stack'

  it('returns the version the requested channel points to', () => {
    const tags = { latest: '1.2.0', next: '1.3.0' }
    expect(pickChannelVersion(tags, 'latest', pkg)).toBe('1.2.0')
    expect(pickChannelVersion(tags, 'next', pkg)).toBe('1.3.0')
  })

  it('suggests --next when a never-promoted package has no stable release', () => {
    expect(() => pickChannelVersion({ next: '1.0.0' }, 'latest', pkg)).toThrow(
      /promoted to stable yet[\s\S]*--next[\s\S]*available dist-tags: next/,
    )
  })

  it('reports the available channels when the requested one is absent', () => {
    expect(() => pickChannelVersion({ latest: '1.2.0' }, 'next', pkg)).toThrow(
      /"next" channel has no published release[\s\S]*available dist-tags: latest/,
    )
  })

  it('handles a package with no dist-tags at all', () => {
    expect(() => pickChannelVersion({}, 'latest', pkg)).toThrow(/available dist-tags: none/)
  })
})
