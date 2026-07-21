import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'pathe'

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'])
const IGNORED_DIRS = new Set([
  '.git',
  '.idea',
  '.next',
  '.turbo',
  '.vite',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'release',
])

const ELECTRON_APIS = [
  'app',
  'autoUpdater',
  'BrowserWindow',
  'clipboard',
  'contextBridge',
  'dialog',
  'globalShortcut',
  'ipcMain',
  'ipcRenderer',
  'Menu',
  'nativeImage',
  'Notification',
  'powerMonitor',
  'screen',
  'session',
  'shell',
  'Tray',
  'webContents',
] as const

const NODE_BUILTINS = [
  'assert',
  'buffer',
  'child_process',
  'cluster',
  'crypto',
  'dgram',
  'dns',
  'events',
  'fs',
  'http',
  'https',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'readline',
  'stream',
  'string_decoder',
  'timers',
  'tls',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'worker_threads',
  'zlib',
] as const

const KNOWN_NATIVE_PACKAGES = new Set([
  '@serialport/bindings-cpp',
  'better-sqlite3',
  'canvas',
  'ffi-napi',
  'iohook',
  'keytar',
  'node-hid',
  'node-pty',
  'ref-napi',
  'serialport',
  'sharp',
  'sqlite3',
  'usb',
])

const KNOWN_NODE_RUNTIME_PACKAGES = new Set(['adm-zip', 'cors', 'express', 'formidable', 'multer'])

const ELECTRON_ONLY_PACKAGES = new Set([
  'electron',
  'electron-builder',
  'electron-debug',
  'electron-is-dev',
  'electron-log',
  'electron-reloader',
  'electron-store',
  'electron-updater',
  'electron-vite',
])

type JsonObject = Record<string, unknown>

export interface SourceLocation {
  file: string
  line: number
}

export interface ApiFinding extends SourceLocation {
  api: string
}

export interface IpcFinding extends SourceLocation {
  direction: 'main' | 'renderer' | 'bridge'
  method: string
  channel: string
}

export interface WindowFinding extends SourceLocation {
  options: Record<string, string | number | boolean>
}

export interface ElectronConversionReport {
  schemaVersion: 1
  generatedAt: string
  source: {
    root: string
    packageManager: 'pnpm' | 'yarn' | 'npm' | 'bun'
    packageFile: 'package.json'
  }
  renderer: {
    kind: 'root-vite' | 'electron-vite'
    root: string
    sourceDir: string
    indexHtml: string | null
    viteConfig: string | null
  }
  entries: {
    main: string[]
    preload: string[]
  }
  identity: {
    packageName: string | null
    productName: string | null
    version: string | null
    appId: string | null
    icon: string | null
    configurationFiles: string[]
  }
  dependencies: {
    renderer: Record<string, string>
    electronOnly: Record<string, string>
    nativeNode: Record<string, string>
    nodeRuntime: Record<string, string>
  }
  electronApis: ApiFinding[]
  ipcChannels: IpcFinding[]
  windows: WindowFinding[]
  nodeBuiltins: ApiFinding[]
  persistence: {
    userDataReferences: SourceLocation[]
    packages: string[]
  }
  tests: {
    scripts: Record<string, string>
    files: string[]
  }
  ignoredDirectories: string[]
  blockers: string[]
}

export class ConversionValidationError extends Error {}

function readJson(file: string): JsonObject {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as JsonObject
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new ConversionValidationError(`cannot read ${file}: ${message}`)
  }
}

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, string> = {}
  for (const [key, item] of Object.entries(value as JsonObject)) {
    if (typeof item === 'string') result[key] = item
  }
  return result
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function relativeFile(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/')
}

function isInside(parent: string, candidate: string): boolean {
  const rel = path.relative(parent, candidate)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

function validateTarget(targetRoot: string): void {
  const dudeFile = path.join(targetRoot, 'dude.json')
  const packageFile = path.join(targetRoot, 'package.json')
  if (
    !existsSync(dudeFile) ||
    !existsSync(packageFile) ||
    !existsSync(path.join(targetRoot, 'src-tauri'))
  ) {
    throw new ConversionValidationError(
      'run this command inside a freshly scaffolded Dude Tauri project',
    )
  }

  const dude = readJson(dudeFile)
  const stack = stringValue(dude.stack)
  const pkg = readJson(packageFile)
  const dependencies = { ...asRecord(pkg.dependencies), ...asRecord(pkg.devDependencies) }
  if (stack !== '@cubocicloide/stack-tauri' && stack !== 'tauri') {
    throw new ConversionValidationError(
      `current Dude project uses ${stack ?? 'an unknown stack'}, not Tauri`,
    )
  }
  if (!dependencies['@cubocicloide/stack-tauri']) {
    throw new ConversionValidationError('current project does not pin @cubocicloide/stack-tauri')
  }
  const scaffoldMarkers = [
    'src/pages/Home/index.tsx',
    'src-tauri/src/commands/greet.rs',
    '.claude/rules/FE/001.md',
  ]
  const missingMarkers = scaffoldMarkers.filter((file) => !existsSync(path.join(targetRoot, file)))
  if (missingMarkers.length > 0) {
    throw new ConversionValidationError(
      `target does not look like a fresh Dude Tauri scaffold; missing: ${missingMarkers.join(', ')}`,
    )
  }
}

function detectPackageManager(root: string): ElectronConversionReport['source']['packageManager'] {
  if (existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(path.join(root, 'yarn.lock'))) return 'yarn'
  if (existsSync(path.join(root, 'bun.lock')) || existsSync(path.join(root, 'bun.lockb')))
    return 'bun'
  return 'npm'
}

function firstExisting(root: string, candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (existsSync(path.join(root, candidate))) return candidate
  }
  return null
}

function rendererSourceDir(root: string, indexHtml: string | null, fallback: string): string {
  if (!indexHtml) return fallback
  const html = readFileSync(path.join(root, indexHtml), 'utf8')
  const entry = html.match(/<script\b[^>]*\bsrc\s*=\s*['"]\/?([^'"?#]+\.[cm]?[jt]sx?)['"]/i)?.[1]
  if (!entry) return fallback
  const directory = path.dirname(entry).split(path.sep).join('/')
  return directory === '.' ? fallback : directory
}

function walkSourceFiles(root: string): { files: string[]; ignored: Set<string> } {
  const files: string[] = []
  const ignored = new Set<string>()

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) {
          ignored.add(relativeFile(root, full))
          continue
        }
        walk(full)
        continue
      }
      if (!entry.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue
      if (statSync(full).size > 1024 * 1024) continue
      files.push(full)
    }
  }

  walk(root)
  return { files, ignored }
}

function linesWithMatches(root: string, files: string[], values: readonly string[]): ApiFinding[] {
  const findings: ApiFinding[] = []
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    const importsElectron = lines.some((line) =>
      /(?:from\s+['"]electron['"]|require\(\s*['"]electron['"]\s*\))/.test(line),
    )
    if (!importsElectron && values === ELECTRON_APIS) continue
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]!
      for (const value of values) {
        const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const nodePattern = new RegExp(
          `(?:from\\s+['"](?:node:)?${escaped}(?:/[^'"]*)?['"]|require\\(\\s*['"](?:node:)?${escaped}(?:/[^'"]*)?['"]\\s*\\))`,
        )
        const matches =
          values === NODE_BUILTINS
            ? nodePattern.test(line)
            : new RegExp(`\\b${escaped}\\b`).test(line)
        if (matches) {
          findings.push({ api: value, file: relativeFile(root, file), line: index + 1 })
        }
      }
    }
  }
  return findings
}

function findIpcChannels(root: string, files: string[]): IpcFinding[] {
  const findings: IpcFinding[] = []
  const patterns: Array<{
    direction: IpcFinding['direction']
    regex: RegExp
  }> = [
    { direction: 'main', regex: /ipcMain\.(handle|on|once)\(\s*['"]([^'"]+)['"]/g },
    {
      direction: 'renderer',
      regex: /ipcRenderer\.(invoke|send|sendSync|on|once)\(\s*['"]([^'"]+)['"]/g,
    },
    { direction: 'bridge', regex: /contextBridge\.exposeInMainWorld\(\s*['"]([^'"]+)['"]/g },
  ]

  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    for (let index = 0; index < lines.length; index++) {
      for (const pattern of patterns) {
        pattern.regex.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = pattern.regex.exec(lines[index]!)) !== null) {
          const bridge = pattern.direction === 'bridge'
          findings.push({
            direction: pattern.direction,
            method: bridge ? 'exposeInMainWorld' : match[1]!,
            channel: bridge ? match[1]! : match[2]!,
            file: relativeFile(root, file),
            line: index + 1,
          })
        }
      }
    }
  }
  return findings
}

function findWindows(root: string, files: string[]): WindowFinding[] {
  const findings: WindowFinding[] = []
  const supportedOptions = new Set([
    'alwaysOnTop',
    'center',
    'frame',
    'fullscreen',
    'height',
    'maxHeight',
    'maxWidth',
    'minHeight',
    'minWidth',
    'resizable',
    'show',
    'title',
    'transparent',
    'width',
    'x',
    'y',
  ])

  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    const pattern = /new\s+BrowserWindow\s*\(\s*\{([\s\S]*?)\}\s*\)/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      const options: Record<string, string | number | boolean> = {}
      const propertyPattern =
        /(?:^|[,\n])\s*([A-Za-z][A-Za-z0-9]*)\s*:\s*(true|false|-?\d+(?:\.\d+)?|['"][^'"]*['"])/g
      let property: RegExpExecArray | null
      while ((property = propertyPattern.exec(match[1]!)) !== null) {
        const key = property[1]!
        if (!supportedOptions.has(key)) continue
        const raw = property[2]!
        options[key] =
          raw === 'true'
            ? true
            : raw === 'false'
              ? false
              : /^-?\d/.test(raw)
                ? Number(raw)
                : raw.slice(1, -1)
      }
      findings.push({
        file: relativeFile(root, file),
        line: content.slice(0, match.index).split(/\r?\n/).length,
        options,
      })
    }
  }
  return findings
}

function persistenceInventory(
  root: string,
  files: string[],
  dependencies: ElectronConversionReport['dependencies'],
): ElectronConversionReport['persistence'] {
  const userDataReferences: SourceLocation[] = []
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    for (let index = 0; index < lines.length; index++) {
      if (/app\.getPath\(\s*['"]userData['"]\s*\)/.test(lines[index]!)) {
        userDataReferences.push({ file: relativeFile(root, file), line: index + 1 })
      }
    }
  }

  const allPackages = {
    ...dependencies.renderer,
    ...dependencies.electronOnly,
    ...dependencies.nativeNode,
    ...dependencies.nodeRuntime,
  }
  const persistencePackages = [
    'better-sqlite3',
    'electron-store',
    'keytar',
    'level',
    'lowdb',
    'node-persist',
    'sqlite3',
  ]
  return {
    userDataReferences,
    packages: persistencePackages.filter((name) => allPackages[name] != null),
  }
}

function configurationIdentity(
  root: string,
  pkg: JsonObject,
): ElectronConversionReport['identity'] {
  const build = pkg.build && typeof pkg.build === 'object' ? (pkg.build as JsonObject) : {}
  const config = pkg.config && typeof pkg.config === 'object' ? (pkg.config as JsonObject) : {}
  const forge = config.forge && typeof config.forge === 'object' ? (config.forge as JsonObject) : {}
  const packager =
    forge.packagerConfig && typeof forge.packagerConfig === 'object'
      ? (forge.packagerConfig as JsonObject)
      : {}
  const configurationFiles = [
    'electron-builder.json',
    'electron-builder.yml',
    'electron-builder.yaml',
    'forge.config.js',
    'forge.config.ts',
  ].filter((file) => existsSync(path.join(root, file)))

  let productName = stringValue(build.productName) ?? stringValue(pkg.productName)
  let appId = stringValue(build.appId) ?? stringValue(packager.appBundleId)
  let icon = stringValue(build.icon) ?? stringValue(packager.icon)

  for (const config of configurationFiles.filter((file) =>
    /electron-builder\.(?:json|ya?ml)$/.test(file),
  )) {
    const configPath = path.join(root, config)
    if (config.endsWith('.json')) {
      const builder = readJson(configPath)
      productName ??= stringValue(builder.productName)
      appId ??= stringValue(builder.appId)
      icon ??= stringValue(builder.icon)
    } else {
      const text = readFileSync(configPath, 'utf8')
      productName ??=
        text.match(/(?:^|\n)\s*productName\s*:\s*['"]?([^'"\r\n,}]+)/)?.[1]?.trim() ?? null
      appId ??= text.match(/(?:^|\n)\s*appId\s*:\s*['"]?([^'"\r\n,}]+)/)?.[1]?.trim() ?? null
      icon ??= text.match(/(?:^|\n)\s*icon\s*:\s*['"]?([^'"\r\n,}]+)/)?.[1]?.trim() ?? null
    }
  }

  icon ??= firstExisting(root, [
    'app-icon.png',
    'assets/icon.png',
    'build/icon.png',
    'resources/icon.png',
    'public/icon.png',
  ])

  return {
    packageName: stringValue(pkg.name),
    productName,
    version: stringValue(pkg.version),
    appId,
    icon,
    configurationFiles,
  }
}

function collectEntries(root: string, pkg: JsonObject): ElectronConversionReport['entries'] {
  const main = new Set<string>()
  const preload = new Set<string>()
  const packageMain = stringValue(pkg.main)
  if (packageMain && existsSync(path.join(root, packageMain))) main.add(packageMain)

  for (const candidate of [
    'main.ts',
    'main.js',
    'main.mjs',
    'main.cjs',
    'src/main.ts',
    'src/main.js',
    'src/main/index.ts',
    'src/main/index.js',
    'src/main/index.mjs',
    'src/main/index.cjs',
    'electron/main/index.ts',
    'electron/main/index.js',
  ]) {
    if (existsSync(path.join(root, candidate))) main.add(candidate)
  }
  for (const candidate of [
    'preload.ts',
    'preload.js',
    'src/preload.ts',
    'src/preload.js',
    'src/preload/index.ts',
    'src/preload/index.js',
    'src/main/preload.ts',
    'src/main/preload.js',
    'electron/preload/index.ts',
    'electron/preload/index.js',
  ]) {
    if (existsSync(path.join(root, candidate))) preload.add(candidate)
  }

  return { main: [...main].sort(), preload: [...preload].sort() }
}

function categorizeDependencies(pkg: JsonObject): ElectronConversionReport['dependencies'] {
  const all = { ...asRecord(pkg.dependencies), ...asRecord(pkg.devDependencies) }
  const renderer: Record<string, string> = {}
  const electronOnly: Record<string, string> = {}
  const nativeNode: Record<string, string> = {}
  const nodeRuntime: Record<string, string> = {}

  for (const [name, version] of Object.entries(all).sort(([a], [b]) => a.localeCompare(b))) {
    if (KNOWN_NATIVE_PACKAGES.has(name)) nativeNode[name] = version
    else if (KNOWN_NODE_RUNTIME_PACKAGES.has(name)) nodeRuntime[name] = version
    else if (ELECTRON_ONLY_PACKAGES.has(name) || name.startsWith('@electron/'))
      electronOnly[name] = version
    else renderer[name] = version
  }
  return { renderer, electronOnly, nativeNode, nodeRuntime }
}

function testInventory(
  root: string,
  pkg: JsonObject,
  files: string[],
): ElectronConversionReport['tests'] {
  const scripts = asRecord(pkg.scripts)
  return {
    scripts: Object.fromEntries(
      Object.entries(scripts).filter(([name]) => /test|spec|e2e/i.test(name)),
    ),
    files: files
      .map((file) => relativeFile(root, file))
      .filter((file) => /(?:^|\/)(?:__tests__\/|.*\.(?:test|spec)\.[cm]?[jt]sx?$)/.test(file))
      .sort(),
  }
}

export function analyzeElectronProject(
  targetRoot: string,
  sourceInput: string,
): ElectronConversionReport {
  const target = path.resolve(targetRoot)
  const source = path.resolve(targetRoot, sourceInput)
  validateTarget(target)

  if (!existsSync(source) || !statSync(source).isDirectory()) {
    throw new ConversionValidationError(`Electron source directory not found: ${source}`)
  }
  if (target === source || isInside(target, source) || isInside(source, target)) {
    throw new ConversionValidationError(
      'Electron source and Tauri target must be separate, non-nested directories',
    )
  }
  if (existsSync(path.join(source, 'src-tauri'))) {
    throw new ConversionValidationError(
      'source already contains src-tauri; expected an Electron project',
    )
  }

  const packageFile = path.join(source, 'package.json')
  if (!existsSync(packageFile)) {
    throw new ConversionValidationError('Electron source has no package.json')
  }
  const pkg = readJson(packageFile)
  const allDependencies = { ...asRecord(pkg.dependencies), ...asRecord(pkg.devDependencies) }
  if (!allDependencies.electron) {
    throw new ConversionValidationError('source package.json does not depend on Electron')
  }
  if (!allDependencies.react || !allDependencies['react-dom']) {
    throw new ConversionValidationError('v1 supports Electron projects with a React renderer only')
  }

  const electronViteConfig = firstExisting(source, [
    'electron.vite.config.ts',
    'electron.vite.config.js',
    'electron.vite.config.mjs',
    'electron.vite.config.cjs',
  ])
  const viteConfig = firstExisting(source, [
    'vite.config.ts',
    'vite.config.js',
    'vite.config.mjs',
    'vite.config.cjs',
  ])
  if (
    !allDependencies.vite &&
    !allDependencies['electron-vite'] &&
    !electronViteConfig &&
    !viteConfig
  ) {
    throw new ConversionValidationError('v1 supports Vite-based Electron renderers only')
  }

  const isElectronVite = electronViteConfig != null || allDependencies['electron-vite'] != null
  const rendererRoot = isElectronVite ? 'src/renderer' : '.'
  const rendererSourceFallback =
    isElectronVite && existsSync(path.join(source, 'src', 'renderer', 'src'))
      ? 'src/renderer/src'
      : 'src'
  const indexHtml = firstExisting(
    source,
    isElectronVite ? ['src/renderer/index.html', 'index.html'] : ['index.html'],
  )
  const rendererSource = rendererSourceDir(source, indexHtml, rendererSourceFallback)

  const { files, ignored } = walkSourceFiles(source)
  const entries = collectEntries(source, pkg)
  const dependencies = categorizeDependencies(pkg)
  const blockers: string[] = []
  if (!indexHtml) blockers.push('Could not locate the renderer index.html.')
  if (entries.main.length === 0)
    blockers.push('Could not locate the Electron main-process entrypoint.')
  if (dependencies.nativeNode && Object.keys(dependencies.nativeNode).length > 0) {
    blockers.push(
      `Native Node dependencies require explicit Rust replacements: ${Object.keys(dependencies.nativeNode).join(', ')}.`,
    )
  }
  if (Object.keys(dependencies.nodeRuntime).length > 0) {
    blockers.push(
      `Node main-process dependencies require Rust or official Tauri replacements: ${Object.keys(dependencies.nodeRuntime).join(', ')}.`,
    )
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: {
      root: source,
      packageManager: detectPackageManager(source),
      packageFile: 'package.json',
    },
    renderer: {
      kind: isElectronVite ? 'electron-vite' : 'root-vite',
      root: rendererRoot,
      sourceDir: rendererSource,
      indexHtml,
      viteConfig: electronViteConfig ?? viteConfig,
    },
    entries,
    identity: configurationIdentity(source, pkg),
    dependencies,
    electronApis: linesWithMatches(source, files, ELECTRON_APIS),
    ipcChannels: findIpcChannels(source, files),
    windows: findWindows(source, files),
    nodeBuiltins: linesWithMatches(source, files, NODE_BUILTINS),
    persistence: persistenceInventory(source, files, dependencies),
    tests: testInventory(source, pkg, files),
    ignoredDirectories: [...ignored].sort(),
    blockers,
  }
}
