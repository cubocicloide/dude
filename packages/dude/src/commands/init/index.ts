import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import { existsSync, readFileSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'pathe'

import { logger } from '../../core/logger.js'
import { loadRegistry, resolveStackSpec } from '../../core/registry.js'
import { loadStack, stackLoadFailureMessage } from '../../core/stack-loader.js'
import { promptVariables } from '../../core/prompts.js'
import { renderTemplateTree } from '../../core/template-runner.js'
import { getPackageRoot, getCliVersion } from '../../utils/paths.js'
import type { StackContext, StackVariable } from '../../core/stack-contract.js'

/**
 * `loadStack` for the init path.
 *
 * `init` is the only way a brand-new project resolves a stack, and it is the most
 * likely place to meet a stack newer than the CLI: `dude init` takes the CLI from
 * `npx @cubocicloide/dude@latest` and the stack from the registry's `latest`
 * independently, and promotion to `latest` is per-package by design. Without this
 * the failure surfaced as a raw ESM/TypeError trace.
 */
async function loadStackOrExplain(
  spec: string,
  cwd: string,
  channel: Parameters<typeof loadStack>[3],
): ReturnType<typeof loadStack> {
  try {
    return await loadStack(spec, cwd, undefined, channel)
  } catch (e) {
    process.stderr.write(stackLoadFailureMessage(spec, undefined, getCliVersion(), e))
    process.exit(1)
  }
}


export const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Scaffold a new project from a stack plugin.',
  },
  args: {
    stack: {
      type: 'string',
      description: 'Stack identifier (registry name, npm spec, or local path).',
      required: false,
    },
    dir: {
      type: 'positional',
      description: 'Target directory (defaults to the current directory).',
      required: false,
    },
    yes: {
      type: 'boolean',
      description: 'Accept all defaults; do not prompt.',
      default: false,
    },
    next: {
      type: 'boolean',
      description:
        'Resolve the stack from the `next` channel (newest published candidate) ' +
        'instead of the latest stable release.',
      default: false,
    },
  },
  async run({ args, rawArgs }) {
    p.intro('dude — project scaffolding')

    const cwd = process.cwd()
    const packageRoot = getPackageRoot()

    // 1. Resolve which stack to use
    let stackSpec = args.stack
    if (!stackSpec) {
      const registry = await loadRegistry(packageRoot)
      const choices = Object.entries(registry.stacks).map(([name]) => ({
        value: name,
        label: name,
      }))
      const chosen = await p.select({
        message: 'Pick a stack',
        options: choices,
      })
      if (p.isCancel(chosen)) {
        p.cancel('Aborted.')
        return
      }
      stackSpec = String(chosen)
    }

    const registry = await loadRegistry(packageRoot)
    const { spec: resolvedSpec } = resolveStackSpec(registry, stackSpec)
    const channel = args.next ? 'next' : 'latest'
    logger.info(`Loading stack: ${resolvedSpec}${args.next ? ' (channel: next)' : ''}`)
    const {
      definition: stack,
      root: stackRoot,
      version: stackVersion,
    } = await loadStackOrExplain(resolvedSpec, cwd, channel)

    // 2. Collect answers. Any CLI flag matching a declared stack variable
    //    (e.g. `--database postgres`, `--celery`) becomes a non-interactive
    //    override, so the whole prompt set can be driven from the command line.
    //    Parsed from rawArgs (not citty's args) because the variable flags are
    //    declared by the stack, not the init command — citty cannot know which
    //    of them take a value vs. which are bare boolean switches.
    const variables = stack.variables ?? []
    const { overrides, dir } = parseStackArgs(rawArgs, variables)
    const answers = await promptVariables(variables, {
      overrides,
      yes: Boolean(args.yes),
    })

    // 3. Resolve destination
    const projectName = String(answers.projectName ?? dir ?? 'my-project')
    const dest = path.resolve(cwd, dir ?? projectName)

    if (existsSync(dest)) {
      const dirEntries = await fs.readdir(dest)
      if (dirEntries.length > 0) {
        if (args.yes) {
          logger.warn(`Directory "${dest}" is not empty; proceeding (--yes).`)
        } else {
          const proceed = await p.confirm({
            message: `Directory "${dest}" is not empty. Continue?`,
            initialValue: false,
          })
          if (!proceed || p.isCancel(proceed)) {
            p.cancel('Aborted.')
            return
          }
        }
      }
    } else {
      await fs.mkdir(dest, { recursive: true })
    }

    const dudeVersion = getCliVersion()

    const ctx: StackContext = {
      answers,
      dest,
      stackRoot,
      dudeVersion,
      stackVersion,
      logger: {
        info: (m) => logger.info(m),
        warn: (m) => logger.warn(m),
        success: (m) => logger.success(m),
        error: (m) => logger.error(m),
      },
    }

    // 4. Lifecycle: preInit
    const spinner = p.spinner()
    spinner.start('Running preInit hook')
    await stack.hooks?.preInit?.(ctx)
    spinner.stop('preInit done')

    // 5. Scaffold
    spinner.start('Scaffolding files')
    if (stack.scaffold) {
      await stack.scaffold(ctx)
    } else {
      // Convention for stacks without a custom scaffold(): a single base
      // template overlay at `templates/base`.
      const templateDir = path.join(stackRoot, 'templates', 'base')
      await renderTemplateTree({
        src: templateDir,
        dest,
        data: { ...answers, dudeVersion, stackVersion },
      })
    }
    spinner.stop('Files generated')

    // 6. Write dude.json
    await writeProjectMetadata({
      dest,
      stackPackageName: getStackPackageName(stackRoot),
      stackVersion,
      answers,
      dudeVersion,
    })

    // 7. Lifecycle: postInit
    spinner.start('Running postInit hook')
    await stack.hooks?.postInit?.(ctx)
    spinner.stop('postInit done')

    p.outro(`Done — project ready at ${dest}`)
  },
})

interface MetadataInput {
  dest: string
  stackPackageName: string
  stackVersion: string
  answers: Record<string, unknown>
  dudeVersion: string
}

async function writeProjectMetadata(input: MetadataInput): Promise<void> {
  const manifest = {
    stack: input.stackPackageName,
    stackVersion: input.stackVersion,
    answers: input.answers,
    generatedAt: new Date().toISOString(),
    dudeVersion: input.dudeVersion,
  }
  await fs.writeFile(
    path.join(input.dest, 'dude.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  )
}

interface ParsedStackArgs {
  /** Variable answers supplied via CLI flags. */
  overrides: Record<string, unknown>
  /** The target directory positional, if one was given. */
  dir?: string
}

/**
 * Parse the raw argv for stack-variable flags and the target-directory
 * positional. For each variable declared by the stack, a matching flag supplies
 * its value non-interactively. Matching is tolerant of casing and dashes, so
 * `--celeryBeat`, `--celery-beat` and `--celerybeat` all map to `celeryBeat`.
 *
 * Boolean variables are bare switches (`--celery`); every other variable, plus
 * `--stack`, consumes the following token as its value (`--database postgres`).
 * Knowing this per-variable is what lets the positional directory survive a
 * trailing boolean flag — something citty cannot do for stack-defined flags.
 */
function parseStackArgs(rawArgs: string[], variables: StackVariable[]): ParsedStackArgs {
  const byKey = new Map<string, StackVariable>()
  const valueFlags = new Set<string>(['stack'])
  for (const v of variables) {
    byKey.set(normalizeKey(v.name), v)
    if (v.type !== 'boolean') valueFlags.add(normalizeKey(v.name))
  }

  const overrides: Record<string, unknown> = {}
  const positionals: string[] = []

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i]!
    if (!arg.startsWith('--')) {
      positionals.push(arg)
      continue
    }
    const eq = arg.indexOf('=')
    let key: string
    let value: unknown
    if (eq !== -1) {
      key = normalizeKey(arg.slice(2, eq))
      value = arg.slice(eq + 1)
    } else {
      key = normalizeKey(arg.slice(2))
      value = valueFlags.has(key) ? rawArgs[++i] : true
    }
    const variable = byKey.get(key)
    if (variable) overrides[variable.name] = coerceVariableValue(variable, value)
  }

  return { overrides, dir: positionals[0] }
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/-/g, '')
}

/** Coerce a raw CLI flag value to the type declared by the variable. */
function coerceVariableValue(v: StackVariable, raw: unknown): unknown {
  if (v.type === 'boolean') {
    if (typeof raw === 'boolean') return raw
    const s = String(raw).toLowerCase()
    return s === '' || s === 'true' || s === '1' || s === 'yes'
  }
  return String(raw)
}

function getStackPackageName(stackRoot: string): string {
  try {
    const pkgPath = path.join(stackRoot, 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name: string }
    return pkg.name
  } catch {
    return 'unknown-stack'
  }
}
