import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  cliChannel,
  detectPackageManager,
  findProjectRoot,
  installedVersion,
  isExactPin,
  needsInstall,
  shouldUseShell,
} from './launcher.js'

const tmpDirs: string[] = []

function makeProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'dude-launcher-'))
  tmpDirs.push(root)
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
  }
  return root
}

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true })
})

describe('findProjectRoot', () => {
  it('finds dude.json in the start dir', () => {
    const root = makeProject({ 'dude.json': '{}' })
    expect(findProjectRoot(root)).toBe(root)
  })

  it('walks up to a parent dude.json', () => {
    const root = makeProject({ 'dude.json': '{}', 'a/b/c/.keep': '' })
    expect(findProjectRoot(join(root, 'a', 'b', 'c'))).toBe(root)
  })

  it('returns null when no dude.json exists anywhere up the tree', () => {
    const root = makeProject({ 'sub/.keep': '' })
    // A bare tmp subdir with no dude.json — walk hits filesystem root → null.
    expect(findProjectRoot(join(root, 'sub'))).toBe(null)
  })
})

describe('detectPackageManager', () => {
  it('prefers pnpm', () => {
    const root = makeProject({ 'dude.json': '{}', 'pnpm-lock.yaml': '' })
    expect(detectPackageManager(root)).toBe('pnpm')
  })
  it('detects yarn', () => {
    const root = makeProject({ 'dude.json': '{}', 'yarn.lock': '' })
    expect(detectPackageManager(root)).toBe('yarn')
  })
  it('falls back to npm', () => {
    const root = makeProject({ 'dude.json': '{}' })
    expect(detectPackageManager(root)).toBe('npm')
  })
})

describe('isExactPin', () => {
  it('treats bare versions as exact', () => {
    expect(isExactPin('0.7.0')).toBe(true)
    expect(isExactPin('6.0.2')).toBe(true)
  })
  it('treats ranges and workspace specs as non-exact', () => {
    expect(isExactPin('^0.7.0')).toBe(false)
    expect(isExactPin('~1.2.3')).toBe(false)
    expect(isExactPin('workspace:*')).toBe(false)
  })
})

describe('shouldUseShell', () => {
  it('uses shell execution on Windows', () => {
    expect(shouldUseShell('win32')).toBe(true)
  })

  it('does not use shell execution on non-Windows platforms', () => {
    expect(shouldUseShell('linux')).toBe(false)
    expect(shouldUseShell('darwin')).toBe(false)
  })
})

describe('cliChannel', () => {
  it('defaults to the stable channel (latest)', () => {
    expect(cliChannel({})).toBe('latest')
  })

  it('returns latest when DUDE_CHANNEL is empty or blank', () => {
    expect(cliChannel({ DUDE_CHANNEL: '' })).toBe('latest')
    expect(cliChannel({ DUDE_CHANNEL: '   ' })).toBe('latest')
  })

  it('honors DUDE_CHANNEL=next', () => {
    expect(cliChannel({ DUDE_CHANNEL: 'next' })).toBe('next')
  })

  it('passes through custom dist-tags', () => {
    expect(cliChannel({ DUDE_CHANNEL: 'canary' })).toBe('canary')
  })
})

describe('installedVersion', () => {
  it('reads the version from node_modules', () => {
    const root = makeProject({
      'dude.json': '{}',
      'node_modules/@cubocicloide/dude/package.json': JSON.stringify({ version: '0.7.0' }),
    })
    expect(installedVersion(root, '@cubocicloide/dude')).toBe('0.7.0')
  })
  it('returns null when the package is absent', () => {
    const root = makeProject({ 'dude.json': '{}' })
    expect(installedVersion(root, '@cubocicloide/dude')).toBe(null)
  })
})

describe('needsInstall', () => {
  const pkgJson = (deps: Record<string, string>) =>
    JSON.stringify({ name: 'app', devDependencies: deps })

  it('needs install when the local bin is missing', () => {
    const root = makeProject({ 'dude.json': '{}', 'package.json': pkgJson({}) })
    expect(needsInstall(root)).toEqual({ needed: true, reason: 'dude binary not installed' })
  })

  it('needs install when a pinned package is not installed', () => {
    const root = makeProject({
      'dude.json': JSON.stringify({ stack: '@cubocicloide/stack-react-fastapi' }),
      'package.json': pkgJson({ '@cubocicloide/dude': '0.7.0' }),
      'node_modules/.bin/dude': '#!/bin/sh\n',
    })
    expect(needsInstall(root).needed).toBe(true)
    expect(needsInstall(root).reason).toContain('not installed')
  })

  it('needs install when an exact pin disagrees with the installed version', () => {
    const root = makeProject({
      'dude.json': '{}',
      'package.json': pkgJson({ '@cubocicloide/dude': '0.8.0' }),
      'node_modules/.bin/dude': '#!/bin/sh\n',
      'node_modules/@cubocicloide/dude/package.json': JSON.stringify({ version: '0.7.0' }),
    })
    expect(needsInstall(root)).toEqual({
      needed: true,
      reason: '@cubocicloide/dude pinned 0.8.0 but 0.7.0 is installed',
    })
  })

  it('is satisfied when exact pins match the installed versions', () => {
    const root = makeProject({
      'dude.json': JSON.stringify({ stack: '@cubocicloide/stack-react-fastapi' }),
      'package.json': pkgJson({
        '@cubocicloide/dude': '0.7.0',
        '@cubocicloide/stack-react-fastapi': '6.0.2',
      }),
      'node_modules/.bin/dude': '#!/bin/sh\n',
      'node_modules/@cubocicloide/dude/package.json': JSON.stringify({ version: '0.7.0' }),
      'node_modules/@cubocicloide/stack-react-fastapi/package.json': JSON.stringify({
        version: '6.0.2',
      }),
    })
    expect(needsInstall(root)).toEqual({ needed: false, reason: '' })
  })

  it('trusts range pins without forcing a reinstall', () => {
    const root = makeProject({
      'dude.json': '{}',
      'package.json': pkgJson({ '@cubocicloide/dude': '^0.7.0' }),
      'node_modules/.bin/dude': '#!/bin/sh\n',
      'node_modules/@cubocicloide/dude/package.json': JSON.stringify({ version: '0.7.5' }),
    })
    expect(needsInstall(root)).toEqual({ needed: false, reason: '' })
  })
})
