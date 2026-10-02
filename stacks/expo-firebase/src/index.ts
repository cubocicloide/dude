import path from 'pathe'
import { rename } from 'node:fs/promises'
import {
  defineCheatsheetCommand,
  defineDocsCommand,
  defineExplainCommand,
  defineStack,
  renderTemplateTree,
} from '@cubocicloide/dude'
import { projectIdentifiers } from './identifiers.js'
import {
  buildCommand,
  devCommand,
  doctorCommand,
  firebaseDeployCommand,
  firebaseEmulatorsCommand,
  formatCommand,
  reviewCommand,
  testCommand,
} from './commands/index.js'
import { lintCommand } from './commands/lint/index.js'

export default defineStack({
  name: 'expo-firebase',
  version: '0.1.0',
  minDudeVersion: '0.17.2',
  description: 'A universal Expo app with Firebase Authentication and Firestore.',
  variables: [
    {
      name: 'projectName',
      type: 'string',
      prompt: 'Project name',
      pattern: '^[a-z][a-z0-9-]*$',
      default: 'my-app',
    },
  ],
  docs: {
    tagline: 'A universal Expo app for Android, iOS and web with Firebase Auth and Firestore.',
    useCases: [
      'A universal Android, iOS and web product built from one React Native codebase',
      'An Expo Go-friendly app with Firebase email/password authentication and Firestore',
      'A mobile team that wants local Firebase emulators and EAS build profiles from day one',
    ],
    technologies: ['Expo SDK 57', 'React Native 0.86', 'Expo Router', 'Firebase 12'],
    pages: [
      { file: 'index.md', title: 'Home' },
      { file: 'architecture.md', title: 'Architecture' },
      { file: 'firebase.md', title: 'Firebase setup' },
      { file: 'emulators.md', title: 'Local emulators' },
      { file: 'testing.md', title: 'Testing' },
      { file: 'builds.md', title: 'EAS builds' },
      { file: 'dude.md', title: 'Working with dude' },
      { file: 'api.md', title: 'Command reference' },
      { file: 'cheatsheet.md', title: 'Cheatsheet' },
      { file: 'mkdocs.md', title: 'Writing docs' },
    ],
  },
  async scaffold(ctx) {
    const projectName = String(ctx.answers.projectName ?? 'my-app')
    const identifiers = projectIdentifiers(projectName)
    await renderTemplateTree({
      src: path.join(ctx.stackRoot, 'templates', 'base'),
      dest: ctx.dest,
      data: {
        ...ctx.answers,
        ...identifiers,
        dudeVersion: ctx.dudeVersion,
        stackVersion: ctx.stackVersion,
      },
    })
    // Expo Router reserves `_layout.tsx`. The template runner intentionally
    // maps single-leading-underscore files to dotfiles, so ship neutral source
    // names and rename them after rendering rather than changing the shared
    // dotfile convention used by every stack.
    for (const directory of ['app', 'app/(auth)', 'app/(app)']) {
      await rename(
        path.join(ctx.dest, directory, 'layout.tsx'),
        path.join(ctx.dest, directory, '_layout.tsx'),
      )
    }
  },
  hooks: {
    async postInit(ctx) {
      const name = String(ctx.answers.projectName ?? 'my-app')
      ctx.logger.info('')
      ctx.logger.info('Next steps:')
      ctx.logger.info(`  1. cd ${name} && pnpm install`)
      ctx.logger.info('  2. dude firebase emulators')
      ctx.logger.info('  3. In another terminal: dude dev --go')
      ctx.logger.info('')
      ctx.logger.info('Node.js 22.13+ and Java 21+ are required; run `dude doctor`.')
    },
  },
  rules: [],
  commands: {
    cheatsheet: defineCheatsheetCommand(),
    explain: defineExplainCommand(),
    dev: devCommand,
    build: buildCommand,
    doctor: doctorCommand,
    lint: lintCommand,
    format: formatCommand,
    review: reviewCommand,
    test: testCommand,
    docs: defineDocsCommand(),
    firebase: {
      emulators: firebaseEmulatorsCommand,
      deploy: firebaseDeployCommand,
    },
  },
})
