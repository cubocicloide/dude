import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const [projectDirectory, packDirectory] = process.argv.slice(2)
if (!projectDirectory || !packDirectory) {
  throw new Error('usage: node scripts/prepare-expo-smoke.mjs <project-dir> <pack-dir>')
}

const archives = await readdir(packDirectory)
const dude = archives.find((file) => /^cubocicloide-dude-.*\.tgz$/.test(file))
const stack = archives.find((file) => /^cubocicloide-stack-expo-firebase-.*\.tgz$/.test(file))
if (!dude || !stack) throw new Error('expected packed dude and expo-firebase archives')

const packageFile = resolve(projectDirectory, 'package.json')
const pkg = JSON.parse(await readFile(packageFile, 'utf8'))
const fileSpec = (file) => `file:${join(resolve(packDirectory), file).replaceAll('\\', '/')}`

pkg.devDependencies['@cubocicloide/dude'] = fileSpec(dude)
pkg.devDependencies['@cubocicloide/stack-expo-firebase'] = fileSpec(stack)
pkg.pnpm ??= {}
pkg.pnpm.overrides ??= {}
pkg.pnpm.overrides['@cubocicloide/dude'] = fileSpec(dude)

await writeFile(packageFile, `${JSON.stringify(pkg, null, 2)}\n`)
