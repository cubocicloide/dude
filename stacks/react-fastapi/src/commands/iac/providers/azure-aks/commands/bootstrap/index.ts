/**
 * `dude iac bootstrap` — create the project-wide shared resources.
 *
 * On Azure that is: a resource group holding the Terraform remote-state storage
 * account + blob container, and the container registry every environment pushes
 * to. Unlike AWS there is no lock table to create — the azurerm backend locks
 * state with a blob lease, which the storage account provides for free.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'
import { projectName } from '../../../../shared.js'
import {
  TF_DIR,
  captureBootstrap,
  hasIac,
  requireEnv,
  requireIac,
  resolveSubscription,
  tfBoot,
} from '../../lib/terraform.js'

/** Replace `key = "..."` in an HCL-ish file, appending the line when absent. */
function setHclScalar(text: string, key: string, value: string): string {
  const line = `${key} = "${value}"`
  const re = new RegExp(`^\\s*${key}\\s*=\\s*".*"\\s*$`, 'm')
  return re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`
}

export const iacBootstrapCommand: StackCommandDef = {
  available: hasIac,
  description:
    'One-time: create the shared resource group, Terraform state storage account and container registry, then write their names into the environment config.',
  args: {
    location: {
      type: 'string',
      description: 'Azure region for the shared resources.',
      default: 'westeurope',
    },
    'state-prefix': {
      type: 'string',
      description:
        'Prefix for the storage account + registry names — both are globally unique across Azure (e.g. your org slug).',
      required: true,
    },
    env: { type: 'string', description: 'Environment whose config to update (required).' },
    subscription: {
      type: 'string',
      description: 'Azure subscription id (default: the env tfvars value, or your az default).',
    },
    yes: { type: 'boolean', description: 'Skip the interactive approval (-auto-approve).' },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const subscription = resolveSubscription(projectRoot, args, env)

    const prefix = String(args['state-prefix'] ?? '')
    if (!prefix) {
      process.stderr.write(
        '\n  ✗  --state-prefix is required (e.g. your org slug — the storage account and\n' +
          '     container registry names must be globally unique across all of Azure).\n\n',
      )
      process.exit(1)
    }
    // Storage account and ACR names are alphanumeric-only and lowercase; rather
    // than silently mangling what the user typed into something they won't
    // recognise in the portal, we reject anything that isn't already valid.
    if (!/^[a-z0-9]{2,12}$/.test(prefix)) {
      process.stderr.write(
        `\n  ✗  invalid --state-prefix "${prefix}".\n` +
          '     Expected 2–12 lowercase letters/digits (no hyphens): Azure storage account\n' +
          '     and container registry names allow nothing else.\n\n',
      )
      process.exit(1)
    }

    const location = String(args.location ?? 'westeurope')
    if (!/^[a-z][a-z0-9]+$/.test(location)) {
      process.stderr.write(
        `\n  ✗  invalid --location "${location}" (expected e.g. westeurope, eastus).\n` +
          '     List them with: az account list-locations --query "[].name" -o tsv\n\n',
      )
      process.exit(1)
    }

    const name = projectName(projectRoot)

    // 1. terraform init (bootstrap keeps local state — no -backend-config needed)
    let status = tfBoot(projectRoot, ['init', '-reconfigure'], subscription)
    if (status !== 0) process.exit(status)

    // 2. terraform apply
    const extra = args.yes ? ['-auto-approve'] : []
    status = tfBoot(
      projectRoot,
      [
        'apply',
        `-var=project_name=${name}`,
        `-var=location=${location}`,
        `-var=state_prefix=${prefix}`,
        ...extra,
      ],
      subscription,
    )
    if (status !== 0) process.exit(status)

    // 3. read outputs
    const out = captureBootstrap(projectRoot, ['output', '-json'], subscription)
    if (out.status !== 0) {
      process.stderr.write('\n  ✗  Could not read bootstrap outputs.\n\n')
      process.exit(1)
    }
    let resourceGroup = ''
    let storageAccount = ''
    let container = ''
    let acrName = ''
    let acrLoginServer = ''
    try {
      const o = JSON.parse(out.stdout) as Record<string, { value?: string }>
      resourceGroup = o.resource_group_name?.value ?? ''
      storageAccount = o.storage_account_name?.value ?? ''
      container = o.container_name?.value ?? ''
      acrName = o.acr_name?.value ?? ''
      acrLoginServer = o.acr_login_server?.value ?? ''
    } catch {
      /* fall through to the guard below */
    }
    if (!resourceGroup || !storageAccount || !container || !acrName) {
      process.stderr.write(
        '\n  ✗  Bootstrap outputs (resource_group_name / storage_account_name /\n' +
          '     container_name / acr_name) not found.\n\n',
      )
      process.exit(1)
    }

    // 4. patch environments/<env>/backend.hcl in place
    const backendHclPath = path.join(projectRoot, TF_DIR, 'environments', env, 'backend.hcl')
    try {
      let hcl = readFileSync(backendHclPath, 'utf8')
      hcl = setHclScalar(hcl, 'resource_group_name', resourceGroup)
      hcl = setHclScalar(hcl, 'storage_account_name', storageAccount)
      hcl = setHclScalar(hcl, 'container_name', container)
      writeFileSync(backendHclPath, hcl)
    } catch {
      process.stderr.write(`\n  ✗  Could not update ${backendHclPath}.\n\n`)
      process.exit(1)
    }

    // 5. patch environments/<env>/terraform.tfvars with the shared registry.
    //    The per-env config reads the registry through a data source, so it has
    //    to be told which one — the name is derived from --state-prefix and
    //    cannot be re-derived without it.
    const tfvarsPath = path.join(projectRoot, TF_DIR, 'environments', env, 'terraform.tfvars')
    try {
      let tfvars = readFileSync(tfvarsPath, 'utf8')
      tfvars = setHclScalar(tfvars, 'acr_name', acrName)
      tfvars = setHclScalar(tfvars, 'acr_resource_group', resourceGroup)
      writeFileSync(tfvarsPath, tfvars)
    } catch {
      process.stderr.write(`\n  ✗  Could not update ${tfvarsPath}.\n\n`)
      process.exit(1)
    }

    process.stdout.write(
      `\n  ✓  Bootstrap complete.\n` +
        `     resource group:  ${resourceGroup}\n` +
        `     state storage:   ${storageAccount}/${container}\n` +
        `     registry:        ${acrLoginServer || acrName}\n` +
        `     Updated:         iac/terraform/environments/${env}/{backend.hcl,terraform.tfvars}\n\n` +
        `  Next: dude iac init --env ${env}\n\n`,
    )
  },
}
