import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { convertElectronCommand } from './index.js'

const roots: string[] = []

function write(root: string, file: string, contents = ''): void {
  const full = join(root, file)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, contents)
}

function fixture(): { target: string; source: string } {
  const root = mkdtempSync(join(tmpdir(), 'dude-electron-command-'))
  roots.push(root)
  const target = join(root, 'target')
  const source = join(root, 'source')
  mkdirSync(target)
  mkdirSync(source)

  write(target, 'dude.json', JSON.stringify({ stack: '@cubocicloide/stack-tauri' }))
  write(
    target,
    'package.json',
    JSON.stringify({ devDependencies: { '@cubocicloide/stack-tauri': '2.0.2' } }),
  )
  write(target, 'src/pages/Home/index.tsx')
  write(target, 'src-tauri/src/commands/greet.rs')
  write(target, '.claude/rules/FE/001.md')

  write(
    source,
    'package.json',
    JSON.stringify({
      name: 'source-app',
      main: 'src/main.ts',
      dependencies: {
        electron: '35.0.0',
        react: '19.0.0',
        'react-dom': '19.0.0',
        vite: '6.0.0',
      },
    }),
  )
  write(source, 'index.html')
  write(source, 'vite.config.ts')
  write(source, 'src/main.ts', "import { app } from 'electron'")
  write(source, 'src/App.tsx')
  return { target, source }
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true })
})

describe('convertElectronCommand', () => {
  it('writes the cache report, prints JSON, and leaves the source unchanged', async () => {
    const { target, source } = fixture()
    const sourcePackage = readFileSync(join(source, 'package.json'), 'utf8')
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

    await convertElectronCommand.run({
      projectRoot: target,
      stackRoot: target,
      args: { source, json: true },
    })

    const reportFile = join(target, '.dude', 'cache', 'electron-conversion.json')
    expect(existsSync(reportFile)).toBe(true)
    const report = JSON.parse(readFileSync(reportFile, 'utf8')) as {
      schemaVersion: number
      source: { root: string }
    }
    expect(report).toMatchObject({
      schemaVersion: 1,
      source: { root: source.replace(/\\/g, '/') },
    })
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining('"schemaVersion": 1'))
    expect(readFileSync(join(source, 'package.json'), 'utf8')).toBe(sourcePackage)
  })

  it('overwrites the same report on an idempotent rerun', async () => {
    const { target, source } = fixture()
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const context = {
      projectRoot: target,
      stackRoot: target,
      args: { source },
    }

    await convertElectronCommand.run(context)
    await convertElectronCommand.run(context)

    const reportFile = join(target, '.dude', 'cache', 'electron-conversion.json')
    expect(() => JSON.parse(readFileSync(reportFile, 'utf8'))).not.toThrow()
  })
})
