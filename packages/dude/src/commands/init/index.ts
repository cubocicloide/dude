import { defineCommand } from 'citty'
import * as p from '@clack/prompts'
import { existsSync, readFileSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'pathe'

import { logger } from '../../core/logger.js'
import { loadRegistry, resolveStackSpec } from '../../core/registry.js'
import { loadStack } from '../../core/stack-loader.js'
import { promptVariables } from '../../core/prompts.js'
import { renderTemplateTree } from '../../core/template-runner.js'
import { getPackageRoot, getCliVersion } from '../../utils/paths.js'
import type { StackContext } from '../../core/stack-contract.js'

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
  },
  async run({ args }) {
    p.intro('dude — project scaffolding')

    const cwd = process.cwd()
    const packageRoot = getPackageRoot()

    // 1. Resolve which stack to use
    let stackSpec = args.stack
    if (!stackSpec) {
      const registry = await loadRegistry(packageRoot)
      const choices = Object.entries(registry.stacks).map(([name, e]) => ({
        value: name,
        label: `${name}  ${e.stable}`,
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
    const resolvedSpec = resolveStackSpec(registry, stackSpec)
    logger.info(`Loading stack: ${resolvedSpec}`)
    const { definition: stack, root: stackRoot } = await loadStack(resolvedSpec, cwd)

    // 2. Collect answers
    const answers = await promptVariables(stack.variables ?? [], {
      yes: Boolean(args.yes),
    })

    // 3. Resolve destination
    const projectName = String(answers.projectName ?? args.dir ?? 'my-project')
    const dest = path.resolve(cwd, args.dir ?? projectName)

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

    const ctx: StackContext = {
      answers,
      dest,
      stackRoot,
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
      const templateDir = path.join(stackRoot, 'template')
      await renderTemplateTree({ src: templateDir, dest, data: answers })
    }
    spinner.stop('Files generated')

    // 6. Write dude.json
    await writeProjectMetadata({
      dest,
      stackPackageName: getStackPackageName(stackRoot),
      stackVersion: stack.version,
      answers,
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
}

async function writeProjectMetadata(input: MetadataInput): Promise<void> {
  const manifest = {
    stack: input.stackPackageName,
    stackVersion: input.stackVersion,
    answers: input.answers,
    generatedAt: new Date().toISOString(),
    dudeVersion: getCliVersion(),
  }
  await fs.writeFile(
    path.join(input.dest, 'dude.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    'utf8',
  )
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
