import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'pathe'
import { defineCommand } from 'citty'

interface ProjectPackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

interface DudeManifest {
  stack?: string
  stackVersion?: string
  dudeVersion?: string
}

function resolvePublishedVersion(packageName: string, requestedVersion?: string): string {
  if (requestedVersion) return requestedVersion

  const spec = requestedVersion ? `${packageName}@${requestedVersion}` : packageName

  try {
    const output = execFileSync('npm', ['view', spec, 'version', '--json'], {
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const parsed: unknown = JSON.parse(output.toString().trim())
    if (typeof parsed === 'string' && parsed.length > 0) return parsed
    if (Array.isArray(parsed) && parsed.length > 0) return String(parsed[parsed.length - 1])
    throw new Error('Unexpected npm view output')
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Could not resolve latest version of ${packageName} from the registry.\n` +
        `Configure npm auth for the package registry or pass an explicit version flag instead.\n` +
        `Examples: --cli-version 0.6.1, --stack-version 5.0.5\n${msg}`,
    )
  }
}

function updateCliDependency(pkg: ProjectPackageJson, version: string): boolean {
  const ranges = [`^${version}`, version]
  const currentDev = pkg.devDependencies?.['@cubocicloide/dude']
  const currentProd = pkg.dependencies?.['@cubocicloide/dude']

  if (currentDev !== undefined) {
    if (ranges.includes(currentDev)) return false
    pkg.devDependencies = { ...pkg.devDependencies, '@cubocicloide/dude': version }
    return true
  }

  if (currentProd !== undefined) {
    if (ranges.includes(currentProd)) return false
    pkg.dependencies = { ...pkg.dependencies, '@cubocicloide/dude': version }
    return true
  }

  pkg.devDependencies = { ...pkg.devDependencies, '@cubocicloide/dude': version }
  return true
}

export const upgradeCommand = defineCommand({
  meta: {
    name: 'upgrade',
    description:
      'Update pinned project versions for the dude CLI and/or active stack. Does not apply migrations.',
  },
  args: {
    cli: {
      type: 'boolean',
      description: 'Upgrade the @cubocicloide/dude version pinned in package.json.',
      default: false,
    },
    stack: {
      type: 'boolean',
      description: 'Upgrade the stackVersion pinned in dude.json.',
      default: false,
    },
    cliVersion: {
      type: 'string',
      description: 'Target dude CLI version. Defaults to the latest published version.',
      required: false,
    },
    stackVersion: {
      type: 'string',
      description: 'Target stack version. Defaults to the latest published version.',
      required: false,
    },
  },
  async run({ args }) {
    const cwd = process.cwd()
    const packageJsonPath = path.join(cwd, 'package.json')
    const dudeJsonPath = path.join(cwd, 'dude.json')

    const cliOnly = Boolean(args.cli)
    const stackOnly = Boolean(args.stack)
    const upgradeCli = cliOnly || (!cliOnly && !stackOnly)
    const upgradeStack = stackOnly || (!cliOnly && !stackOnly)

    let wrote = false

    if (upgradeCli) {
      if (!existsSync(packageJsonPath)) {
        throw new Error('package.json not found in the current directory.')
      }

      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as ProjectPackageJson
      const targetCliVersion = resolvePublishedVersion(
        '@cubocicloide/dude',
        typeof args.cliVersion === 'string' ? args.cliVersion : undefined,
      )
      const changed = updateCliDependency(pkg, targetCliVersion)
      let manifestChanged = false

      if (changed) {
        await fs.writeFile(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
        process.stdout.write(`Updated package.json: @cubocicloide/dude -> ${targetCliVersion}\n`)
        process.stdout.write('Run `pnpm install` to refresh the lockfile and local binary.\n')
        wrote = true
      } else {
        process.stdout.write(`package.json already pins @cubocicloide/dude ${targetCliVersion}.\n`)
      }

      if (existsSync(dudeJsonPath)) {
        const manifest = JSON.parse(readFileSync(dudeJsonPath, 'utf8')) as DudeManifest
        if (manifest.dudeVersion !== targetCliVersion) {
          manifest.dudeVersion = targetCliVersion
          await fs.writeFile(dudeJsonPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
          manifestChanged = true
        }
      }

      if (manifestChanged) {
        process.stdout.write(`Updated dude.json: dudeVersion -> ${targetCliVersion}\n`)
        wrote = true
      }
    }

    if (upgradeStack) {
      if (!existsSync(dudeJsonPath)) {
        throw new Error('dude.json not found in the current directory.')
      }

      const manifest = JSON.parse(readFileSync(dudeJsonPath, 'utf8')) as DudeManifest
      if (!manifest.stack) {
        throw new Error('dude.json is missing the `stack` field.')
      }
      if (manifest.stack.startsWith('.') || manifest.stack.startsWith('/')) {
        throw new Error('Local path stacks cannot be upgraded with `dude upgrade --stack`.')
      }

      const targetStackVersion = resolvePublishedVersion(
        manifest.stack,
        typeof args.stackVersion === 'string' ? args.stackVersion : undefined,
      )

      if (manifest.stackVersion === targetStackVersion) {
        process.stdout.write(`dude.json already pins ${manifest.stack}@${targetStackVersion}.\n`)
      } else {
        manifest.stackVersion = targetStackVersion
        await fs.writeFile(dudeJsonPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
        process.stdout.write(`Updated dude.json: ${manifest.stack} -> ${targetStackVersion}\n`)
        wrote = true
      }
    }

    if (!wrote) {
      process.stdout.write('Nothing to update.\n')
    }
  },
})