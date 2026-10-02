import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Project } from '@cubocicloide/dude/testing'

let project: Project

describe('expo-firebase scaffold', () => {
  beforeAll(() => {
    project = Project.scaffold({
      stack: './stacks/expo-firebase',
      prefix: 'dude-expo-firebase-',
    })
  }, 60_000)

  afterAll(() => project.cleanup())

  it('renders the universal Expo and Firebase application', () => {
    for (const file of [
      'app/_layout.tsx',
      'app/(auth)/sign-in.tsx',
      'app/(auth)/sign-up.tsx',
      'app/(app)/index.tsx',
      'src/config/env.ts',
      'src/lib/firebase/auth.ts',
      'src/features/notes/repository.ts',
      'firebase.json',
      'firestore.rules',
      'eas.json',
      '.env.example',
      'assets/icon.png',
      'assets/splash.png',
    ]) {
      expect(project.exists(file), `expected ${file}`).toBe(true)
    }

    const pkg = JSON.parse(project.readFile('package.json')) as {
      dependencies: Record<string, string>
      engines: { node: string }
    }
    expect(pkg.dependencies.expo).toMatch(/^~57\./)
    expect(pkg.dependencies['react-native']).toMatch(/^0\.86\./)
    expect(pkg.dependencies.firebase).toMatch(/^\^12\./)
    expect(pkg.engines.node).toBe('>=22.13')
  })

  it('passes structural lint before dependencies are installed', () => {
    const result = project.run('lint')
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toContain('No issues found.')
  })

  it('discovers the stack command surface', () => {
    const rootHelp = project.run('help', '--format', 'json')
    expect(rootHelp.status).toBe(0)
    const catalog = JSON.parse(rootHelp.stdout) as {
      commands: Array<{ name: string }>
      groups: Array<{ name: string; subcommands: Array<{ name: string }> }>
    }
    const commands = catalog.commands.map((command) => command.name)
    for (const command of ['build', 'dev', 'doctor', 'firebase', 'format', 'review', 'test']) {
      if (command !== 'firebase') expect(commands).toContain(command)
    }

    const firebase = catalog.groups.find((group) => group.name === 'firebase')
    expect(firebase?.subcommands.map((command) => command.name)).toEqual([
      'emulators',
      'deploy',
    ])
  })

  it('reports representative React Native and Firebase mutations', () => {
    project.remove('src/config/env.ts')
    let result = project.run('lint')
    expect(result.status).toBe(1)
    expect(result.stdout + result.stderr).toContain('RN001')
    project.restore('src/config/env.ts')

    project.write(
      'firestore.rules',
      "rules_version = '2'; service cloud.firestore { match /databases/{database}/documents { match /{document=**} { allow read, write: if true; } } }",
    )
    result = project.run('lint')
    expect(result.status).toBe(1)
    expect(result.stdout + result.stderr).toContain('FB004')
    project.restore('firestore.rules')
  })

  it('prints an actionable error when a required project CLI is missing', () => {
    const result = project.run('dev', '--platform', 'web')
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('expo is not installed')
    expect(result.stderr).toContain('pnpm install')
  })
})
