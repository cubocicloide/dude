import { existsSync } from 'node:fs'
import path from 'pathe'
import { formatDiagnostic, runLint, type StackCommandDef } from '@cubocicloide/dude'
import { capture, exec, projectAnswer, requireLocalBin, section } from './_exec.js'

const PLATFORMS = new Set(['all', 'android', 'ios', 'web'])
const PROFILES = new Set(['development', 'preview', 'production'])

function checked(value: unknown, allowed: Set<string>, label: string): string {
  const result = String(value ?? '')
  if (!allowed.has(result)) {
    process.stderr.write(`error: ${label} must be one of: ${[...allowed].join(', ')}\n`)
    process.exit(1)
  }
  return result
}

export function checkedLiveProject(value: unknown): string {
  const project = String(value ?? '')
  if (!project || project.startsWith('demo-')) {
    process.stderr.write('error: --project must name a live Firebase project, not a demo-* id.\n')
    process.exit(1)
  }
  return project
}

export function mobileBuildArgs(platform: string, profile: string): string[] {
  return ['dlx', 'eas-cli', 'build', '--platform', platform, '--profile', profile]
}

export function nestedCommand(command: string): string {
  return process.platform === 'win32' ? `"${command}"` : command
}

export const devCommand: StackCommandDef = {
  description: 'Start Expo for Android, iOS, web, Expo Go, or a development client.',
  args: {
    platform: { type: 'string', default: 'all', description: 'all, android, ios, or web.' },
    go: { type: 'boolean', default: false, description: 'Force Expo Go.' },
    devClient: { type: 'boolean', default: false, description: 'Target a development client.' },
    clear: { type: 'boolean', default: false, description: 'Clear the Metro cache.' },
    tunnel: { type: 'boolean', default: false, description: 'Use an Expo tunnel.' },
  },
  async run({ projectRoot, args }) {
    if (args.go && args.devClient) {
      process.stderr.write('error: --go and --dev-client are mutually exclusive.\n')
      process.exit(1)
    }
    const platform = checked(args.platform ?? 'all', PLATFORMS, 'platform')
    const expo = requireLocalBin(projectRoot, 'expo')
    const cliArgs = ['start']
    if (platform !== 'all') cliArgs.push(`--${platform}`)
    if (args.go) cliArgs.push('--go')
    if (args.devClient) cliArgs.push('--dev-client')
    if (args.clear) cliArgs.push('--clear')
    if (args.tunnel) cliArgs.push('--tunnel')
    if (!exec(expo, cliArgs, projectRoot)) process.exit(1)
  },
}

export const buildCommand: StackCommandDef = {
  description: 'Build mobile binaries with EAS, or export the web application locally.',
  args: {
    platform: {
      type: 'string',
      required: true,
      description: 'android, ios, all, or web.',
    },
    profile: {
      type: 'string',
      default: 'preview',
      description: 'development, preview, or production (mobile only).',
    },
  },
  async run({ projectRoot, args }) {
    const platform = checked(args.platform, PLATFORMS, 'platform')
    if (platform === 'web') {
      const expo = requireLocalBin(projectRoot, 'expo')
      if (!exec(expo, ['export', '--platform', 'web'], projectRoot)) process.exit(1)
      return
    }
    const profile = checked(args.profile ?? 'preview', PROFILES, 'profile')
    if (!exec('pnpm', mobileBuildArgs(platform, profile), projectRoot)) {
      process.exit(1)
    }
  },
}

export const firebaseEmulatorsCommand: StackCommandDef = {
  description: 'Start the Firebase Auth and Firestore emulators plus the Emulator UI.',
  args: {
    project: { type: 'string', description: 'Firebase project id; defaults to demo-<project>.' },
  },
  async run({ projectRoot, args }) {
    const firebase = requireLocalBin(projectRoot, 'firebase')
    const name = projectAnswer(projectRoot, 'projectName') ?? path.basename(projectRoot)
    const fallback = `demo-${name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`
    const project = String(args.project ?? fallback)
    if (
      !exec(
        firebase,
        ['emulators:start', '--only', 'auth,firestore', '--project', project],
        projectRoot,
      )
    ) {
      process.exit(1)
    }
  },
}

export const firebaseDeployCommand: StackCommandDef = {
  description: 'Test and deploy only Firestore rules and indexes to a live Firebase project.',
  args: {
    project: { type: 'string', required: true, description: 'Live Firebase project id.' },
  },
  async run({ projectRoot, args }) {
    const project = checkedLiveProject(args.project)
    const firebase = requireLocalBin(projectRoot, 'firebase')
    section('Firestore security rules tests')
    if (
      !exec(
        firebase,
        [
          'emulators:exec',
          '--only',
          'firestore',
          '--project',
          `demo-${project}`,
          nestedCommand('pnpm test:rules'),
        ],
        projectRoot,
      )
    ) {
      process.exit(1)
    }
    section(`Deploy Firestore configuration to ${project}`)
    if (
      !exec(
        firebase,
        ['deploy', '--only', 'firestore:rules,firestore:indexes', '--project', project],
        projectRoot,
      )
    ) {
      process.exit(1)
    }
  },
}

export const doctorCommand: StackCommandDef = {
  description: 'Check the Expo, Firebase, EAS, Node, pnpm, and Java prerequisites.',
  async run({ projectRoot }) {
    const rows: Array<[string, boolean, string, boolean]> = []
    const node = process.versions.node
    const [major = 0, minor = 0] = node.split('.').map(Number)
    rows.push(['Node >= 22.13', major > 22 || (major === 22 && minor >= 13), node, true])
    const pnpm = capture('pnpm', ['--version'])
    rows.push(['pnpm', pnpm != null, pnpm ?? 'missing', true])
    rows.push([
      'project dependencies',
      existsSync(path.join(projectRoot, 'node_modules')),
      'node_modules',
      true,
    ])
    for (const bin of ['expo', 'firebase']) {
      rows.push([
        bin,
        existsSync(
          path.join(
            projectRoot,
            'node_modules',
            '.bin',
            process.platform === 'win32' ? `${bin}.cmd` : bin,
          ),
        ),
        'project-local CLI',
        true,
      ])
    }
    const eas = capture('eas', ['--version'])
    rows.push([
      'EAS CLI (optional)',
      eas != null,
      eas ?? 'not global; builds use pnpm dlx',
      false,
    ])
    const java = capture('java', ['-version'])
    const javaMajor = Number(java?.match(/version "(\d+)/)?.[1] ?? 0)
    rows.push(['Java >= 21', javaMajor >= 21, java ?? 'missing', true])

    for (const [label, ok, detail] of rows) {
      process.stdout.write(
        `  ${ok ? 'OK  ' : 'FAIL'} ${label.padEnd(24)} ${detail.split('\n')[0]}\n`,
      )
    }
    if (rows.some((row) => row[3] && !row[1])) process.exit(1)
  },
}

export const formatCommand: StackCommandDef = {
  description: 'Format the Expo application, Firebase configuration, tests, and docs.',
  args: {
    check: { type: 'boolean', default: false, description: 'Check without writing files.' },
  },
  async run({ projectRoot, args }) {
    const prettier = requireLocalBin(projectRoot, 'prettier')
    if (!exec(prettier, [args.check ? '--check' : '--write', '.'], projectRoot)) process.exit(1)
  },
}

export const reviewCommand: StackCommandDef = {
  description: 'Run structural lint, ESLint, TypeScript, Prettier, and Expo Doctor.',
  async run({ projectRoot, stackRoot }) {
    let ok = true
    section('dude lint')
    const result = await runLint(projectRoot, stackRoot)
    for (const diagnostic of result.diagnostics)
      process.stdout.write(`${formatDiagnostic(diagnostic)}\n`)
    ok = result.errorCount === 0 && ok

    const eslint = requireLocalBin(projectRoot, 'eslint')
    const tsc = requireLocalBin(projectRoot, 'tsc')
    const prettier = requireLocalBin(projectRoot, 'prettier')
    const expoDoctor = requireLocalBin(projectRoot, 'expo-doctor')
    section('eslint')
    ok = exec(eslint, ['.', '--max-warnings', '0'], projectRoot) && ok
    section('typescript')
    ok = exec(tsc, ['--noEmit'], projectRoot) && ok
    section('prettier')
    ok = exec(prettier, ['--check', '.'], projectRoot) && ok
    section('expo doctor')
    ok = exec(expoDoctor, [], projectRoot) && ok
    if (!ok) process.exit(1)
  },
}

export const testCommand: StackCommandDef = {
  description: 'Run Jest unit/component tests and Firestore emulator rules tests.',
  args: {
    unit: { type: 'boolean', default: false, description: 'Run only unit/component tests.' },
    emulator: { type: 'boolean', default: false, description: 'Run only emulator rules tests.' },
  },
  async run({ projectRoot, args }) {
    const unitOnly = Boolean(args.unit) && !args.emulator
    const emulatorOnly = Boolean(args.emulator) && !args.unit
    let ok = true
    if (!emulatorOnly) {
      section('Jest')
      const jest = requireLocalBin(projectRoot, 'jest')
      ok =
        exec(
          jest,
          ['--runInBand', '--testPathIgnorePatterns', 'firestore.rules.test.ts'],
          projectRoot,
        ) && ok
    }
    if (!unitOnly) {
      section('Firebase Emulator Suite')
      const firebase = requireLocalBin(projectRoot, 'firebase')
      const name = projectAnswer(projectRoot, 'projectName') ?? path.basename(projectRoot)
      const demo = `demo-${name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`
      ok =
        exec(
          firebase,
          [
            'emulators:exec',
            '--only',
            'firestore',
            '--project',
            demo,
            nestedCommand('pnpm test:rules'),
          ],
          projectRoot,
        ) && ok
    }
    if (!ok) process.exit(1)
  },
}

export { checked }
