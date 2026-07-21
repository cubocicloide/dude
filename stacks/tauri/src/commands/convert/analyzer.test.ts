import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { analyzeElectronProject, ConversionValidationError } from './analyzer.js'

const roots: string[] = []

function write(root: string, file: string, contents = ''): void {
  const full = join(root, file)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, contents)
}

function workspace(): { root: string; target: string; source: string } {
  const root = mkdtempSync(join(tmpdir(), 'dude-electron-convert-'))
  roots.push(root)
  const target = join(root, 'tauri-target')
  const source = join(root, 'electron-source')
  mkdirSync(target)
  mkdirSync(source)

  write(
    target,
    'dude.json',
    JSON.stringify({ stack: '@cubocicloide/stack-tauri', stackVersion: '2.0.2' }),
  )
  write(
    target,
    'package.json',
    JSON.stringify({ devDependencies: { '@cubocicloide/stack-tauri': '2.0.2' } }),
  )
  write(target, 'src/pages/Home/index.tsx', 'export default function Home() { return null }')
  write(target, 'src-tauri/src/commands/greet.rs', '')
  write(target, '.claude/rules/FE/001.md', '')
  return { root, target, source }
}

function electronPackage(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    name: 'legacy-desktop',
    version: '4.2.0',
    main: 'src/main.ts',
    scripts: { test: 'vitest run', e2e: 'playwright test', build: 'vite build' },
    dependencies: { electron: '^35.0.0', react: '^19.0.0', 'react-dom': '^19.0.0' },
    devDependencies: { vite: '^6.0.0', vitest: '^2.0.0' },
    build: {
      productName: 'Legacy Desktop',
      appId: 'com.example.legacy',
      icon: 'assets/icon.png',
    },
    ...extra,
  })
}

afterEach(() => {
  while (roots.length) rmSync(roots.pop()!, { recursive: true, force: true })
})

describe('analyzeElectronProject', () => {
  it('inventories a root Vite Electron project', () => {
    const { target, source } = workspace()
    write(source, 'package.json', electronPackage())
    write(source, 'pnpm-lock.yaml')
    write(source, 'index.html', '<div id="root"></div>')
    write(source, 'vite.config.ts', 'export default {}')
    write(
      source,
      'src/main.ts',
      "import { app, BrowserWindow, ipcMain } from 'electron'\n" +
        "import fs from 'node:fs'\n" +
        "const dataDir = app.getPath('userData')\n" +
        'const win = new BrowserWindow({ width: 1200, height: 800, show: false })\n' +
        "ipcMain.handle('files:read', () => fs.readFileSync('x'))",
    )
    write(
      source,
      'src/preload.ts',
      "import { contextBridge, ipcRenderer } from 'electron'\ncontextBridge.exposeInMainWorld('desktop', { read: () => ipcRenderer.invoke('files:read') })",
    )
    write(source, 'src/App.tsx', 'export default function App() { return <main /> }')
    write(source, 'src/App.test.tsx', 'it("renders", () => {})')
    write(source, 'node_modules/electron/index.js', 'throw new Error("must be ignored")')
    write(source, 'dist/main.js', 'ipcMain.handle("ignored", () => {})')

    const report = analyzeElectronProject(target, source)

    expect(report.source.packageManager).toBe('pnpm')
    expect(report.renderer).toMatchObject({
      kind: 'root-vite',
      root: '.',
      sourceDir: 'src',
      indexHtml: 'index.html',
      viteConfig: 'vite.config.ts',
    })
    expect(report.entries.main).toContain('src/main.ts')
    expect(report.entries.preload).toContain('src/preload.ts')
    expect(report.identity).toMatchObject({
      packageName: 'legacy-desktop',
      productName: 'Legacy Desktop',
      version: '4.2.0',
      appId: 'com.example.legacy',
      icon: 'assets/icon.png',
    })
    expect(report.electronApis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ api: 'BrowserWindow', file: 'src/main.ts' }),
      ]),
    )
    expect(report.ipcChannels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ direction: 'main', method: 'handle', channel: 'files:read' }),
        expect.objectContaining({ direction: 'renderer', method: 'invoke', channel: 'files:read' }),
        expect.objectContaining({ direction: 'bridge', channel: 'desktop' }),
      ]),
    )
    expect(report.nodeBuiltins).toContainEqual(expect.objectContaining({ api: 'fs' }))
    expect(report.windows).toContainEqual(
      expect.objectContaining({ options: { width: 1200, height: 800, show: false } }),
    )
    expect(report.persistence.userDataReferences).toEqual([
      expect.objectContaining({ file: 'src/main.ts', line: 3 }),
    ])
    expect(report.tests.files).toEqual(['src/App.test.tsx'])
    expect(report.tests.scripts).toEqual({ test: 'vitest run', e2e: 'playwright test' })
    expect(report.ignoredDirectories).toEqual(expect.arrayContaining(['dist', 'node_modules']))
    expect(report.ipcChannels.some((item) => item.channel === 'ignored')).toBe(false)
    expect(report.blockers).toEqual([])
  })

  it('keeps a root-Vite renderer under src/renderer out of electron-vite mode', () => {
    const { target, source } = workspace()
    write(
      source,
      'package.json',
      electronPackage({
        main: 'src/main/index.js',
        dependencies: {
          electron: '^35.0.0',
          react: '^19.0.0',
          'react-dom': '^19.0.0',
          express: '^4.0.0',
          multer: '^2.0.0',
        },
      }),
    )
    write(
      source,
      'index.html',
      '<div id="root"></div><script type="module" src="/src/renderer/main.jsx"></script>',
    )
    write(source, 'vite.config.mjs', 'export default {}')
    write(source, 'src/main/index.js', "const { BrowserWindow } = require('electron')")
    write(source, 'src/main/preload.js', "const { contextBridge } = require('electron')")
    write(source, 'src/renderer/main.jsx', 'export {}')

    const report = analyzeElectronProject(target, source)

    expect(report.renderer).toMatchObject({
      kind: 'root-vite',
      root: '.',
      sourceDir: 'src/renderer',
      indexHtml: 'index.html',
      viteConfig: 'vite.config.mjs',
    })
    expect(report.entries.main).toEqual(['src/main/index.js'])
    expect(report.entries.preload).toEqual(['src/main/preload.js'])
    expect(report.dependencies.nodeRuntime).toEqual({
      express: '^4.0.0',
      multer: '^2.0.0',
    })
    expect(report.dependencies.renderer).not.toHaveProperty('express')
    expect(report.blockers.join('\n')).toContain('Node main-process dependencies')
  })

  it('detects electron-vite layout, YAML identity, and native dependency blockers', () => {
    const { target, source } = workspace()
    write(
      source,
      'package.json',
      electronPackage({
        main: 'out/main/index.js',
        dependencies: {
          electron: '^35.0.0',
          react: '^19.0.0',
          'react-dom': '^19.0.0',
          'better-sqlite3': '^11.0.0',
        },
        devDependencies: { 'electron-vite': '^3.0.0' },
        build: undefined,
      }),
    )
    write(source, 'electron.vite.config.ts', 'export default {}')
    write(
      source,
      'electron-builder.yml',
      'appId: com.example.yaml\nproductName: YAML App\nicon: build/icon.png\n',
    )
    write(source, 'src/main/index.ts', "import { app } from 'electron'")
    write(source, 'src/preload/index.ts', "import { contextBridge } from 'electron'")
    write(source, 'src/renderer/index.html', '<div id="root"></div>')
    write(source, 'src/renderer/src/App.tsx', 'export default function App() { return null }')

    const report = analyzeElectronProject(target, source)

    expect(report.renderer).toMatchObject({
      kind: 'electron-vite',
      root: 'src/renderer',
      sourceDir: 'src/renderer/src',
      indexHtml: 'src/renderer/index.html',
      viteConfig: 'electron.vite.config.ts',
    })
    expect(report.identity).toMatchObject({
      productName: 'YAML App',
      appId: 'com.example.yaml',
      icon: 'build/icon.png',
    })
    expect(report.dependencies.nativeNode).toEqual({ 'better-sqlite3': '^11.0.0' })
    expect(report.blockers.join('\n')).toContain('better-sqlite3')
  })

  it('reads electron-builder JSON identity metadata', () => {
    const { target, source } = workspace()
    write(source, 'package.json', electronPackage({ build: undefined }))
    write(
      source,
      'electron-builder.json',
      JSON.stringify({
        productName: 'JSON App',
        appId: 'com.example.json',
        icon: 'resources/json-icon.png',
      }),
    )
    write(source, 'index.html')
    write(source, 'vite.config.ts')
    write(source, 'src/main.ts', "import { app } from 'electron'")
    write(source, 'src/App.tsx')

    expect(analyzeElectronProject(target, source).identity).toMatchObject({
      productName: 'JSON App',
      appId: 'com.example.json',
      icon: 'resources/json-icon.png',
    })
  })

  it('accepts a source path relative to the Tauri project', () => {
    const { target, source } = workspace()
    write(source, 'package.json', electronPackage())
    write(source, 'index.html')
    write(source, 'vite.config.ts')
    write(source, 'src/main.ts', "import { app } from 'electron'")
    write(source, 'src/App.tsx')

    const sourceRelativeToTarget = relative(target, source)
    expect(analyzeElectronProject(target, sourceRelativeToTarget).source.root).toBe(
      source.replace(/\\/g, '/'),
    )
  })

  it('is stable across repeated analysis apart from the timestamp', () => {
    const { target, source } = workspace()
    write(source, 'package.json', electronPackage())
    write(source, 'index.html')
    write(source, 'vite.config.ts')
    write(source, 'src/main.ts', "import { app } from 'electron'")
    write(source, 'src/App.tsx')

    const first = analyzeElectronProject(target, source)
    const second = analyzeElectronProject(target, source)
    expect({ ...second, generatedAt: first.generatedAt }).toEqual(first)
  })

  it.each([
    ['missing source', (target: string) => join(target, '..', 'missing'), 'not found'],
    ['same directory', (target: string) => target, 'separate, non-nested'],
    ['nested source', (target: string) => join(target, 'legacy'), 'separate, non-nested'],
  ])('rejects %s', (_name, sourcePath, expected) => {
    const { target } = workspace()
    const candidate = sourcePath(target)
    if (candidate.endsWith('legacy')) mkdirSync(candidate, { recursive: true })
    expect(() => analyzeElectronProject(target, candidate)).toThrow(expected)
  })

  it('rejects a target nested inside the source', () => {
    const root = mkdtempSync(join(tmpdir(), 'dude-electron-nested-'))
    roots.push(root)
    const source = join(root, 'electron')
    const target = join(source, 'tauri')
    mkdirSync(target, { recursive: true })
    write(target, 'dude.json', JSON.stringify({ stack: '@cubocicloide/stack-tauri' }))
    write(
      target,
      'package.json',
      JSON.stringify({ devDependencies: { '@cubocicloide/stack-tauri': '2.0.2' } }),
    )
    write(target, 'src/pages/Home/index.tsx')
    write(target, 'src-tauri/src/commands/greet.rs')
    write(target, '.claude/rules/FE/001.md')
    expect(() => analyzeElectronProject(target, source)).toThrow('separate, non-nested')
  })

  it.each([
    ['not Electron', { react: '19', 'react-dom': '19', vite: '6' }, 'does not depend on Electron'],
    ['not React', { electron: '35', vite: '6' }, 'React renderer only'],
    ['not Vite', { electron: '35', react: '19', 'react-dom': '19' }, 'Vite-based'],
  ])('rejects a project that is %s', (_name, dependencies, expected) => {
    const { target, source } = workspace()
    write(source, 'package.json', JSON.stringify({ dependencies }))
    expect(() => analyzeElectronProject(target, source)).toThrow(expected)
  })

  it('rejects an existing Tauri source and a modified target', () => {
    const first = workspace()
    write(first.source, 'src-tauri/tauri.conf.json', '{}')
    write(first.source, 'package.json', electronPackage())
    expect(() => analyzeElectronProject(first.target, first.source)).toThrow(
      'already contains src-tauri',
    )

    const second = workspace()
    rmSync(join(second.target, 'src/pages/Home/index.tsx'))
    expect(() => analyzeElectronProject(second.target, second.source)).toThrow(
      ConversionValidationError,
    )
    expect(() => analyzeElectronProject(second.target, second.source)).toThrow(
      'fresh Dude Tauri scaffold',
    )
  })
})
