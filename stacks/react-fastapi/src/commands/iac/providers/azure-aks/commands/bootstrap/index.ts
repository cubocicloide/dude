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
import { projectName, sleepMs } from '../../../../shared.js'
import { capture } from '../../lib/exec.js'
import {
  TF_BOOTSTRAP_DIR,
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

    // 0. Record the inputs next to the bootstrap config, as an auto-loaded
    //    tfvars file.
    //
    //    Terraform loads `*.auto.tfvars` for every command that takes variables
    //    — including `destroy`, which `dude iac destroy` runs without any -var
    //    flags because it has no way to know what prefix the bootstrap was
    //    created with. Without this file those variables silently fall back to
    //    their defaults, so the destroy plan recomputes the resource names from
    //    `state_prefix = "changeme"` and reports that it is deleting
    //    `changeme<project>acr`. The teardown is still correct (Terraform acts
    //    on the resource ids in state, not on recomputed names), but the plan it
    //    shows is a lie — and the first person to read one carefully will stop
    //    the destroy, reasonably believing it is pointed at the wrong registry.
    //
    //    It is also what makes a later `dude iac bootstrap` re-run, or a
    //    teammate's destroy, reproduce the same names without being told the
    //    original flags. No secrets: it holds a project slug, a region and a
    //    name prefix, so it belongs in version control.
    const autoTfvars = path.join(projectRoot, TF_BOOTSTRAP_DIR, 'bootstrap.auto.tfvars')
    try {
      writeFileSync(
        autoTfvars,
        '# Written by `dude iac bootstrap`. Terraform loads *.auto.tfvars on every\n' +
          '# command, so `destroy` reproduces these names without being passed them.\n' +
          '# Commit this file; changing it by hand will point the bootstrap at\n' +
          '# different resources.\n\n' +
          `project_name = "${name}"\n` +
          `location     = "${location}"\n` +
          `state_prefix = "${prefix}"\n`,
      )
    } catch {
      process.stderr.write(`\n  ✗  Could not write ${autoTfvars}.\n\n`)
      process.exit(1)
    }

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

    // 6. Wait for the state container to actually answer a blob listing.
    //
    // Creating the account and the container returns long before the account's
    // blob endpoint is reachable, and the very next command a user runs —
    // `dude iac init` — lists blobs to enumerate workspaces. It then fails with
    // a bare `ListBlobs: 404 ResourceNotFound`, which reads like the container
    // was never created rather than "try again in a minute". Blocking here,
    // where we know what was just built, turns that into a wait.
    //
    // The probe mirrors what Terraform does: listing CONTAINERS succeeds well
    // before listing BLOBS inside one does, so checking the container exists is
    // not enough.
    const ready = (): boolean =>
      capture(
        'az',
        [
          'storage',
          'blob',
          'list',
          '--account-name',
          storageAccount,
          '--container-name',
          container,
          '--auth-mode',
          'key',
          '--num-results',
          '1',
          '--output',
          'none',
        ],
        projectRoot,
        subscription,
      ).status === 0

    if (!ready()) {
      process.stdout.write('\n  →  Waiting for the state container to become reachable…\n')
      let attempts = 0
      while (attempts < 12 && !ready()) {
        sleepMs(15_000)
        attempts++
      }
      if (attempts >= 12) {
        process.stderr.write(
          `\n  ⚠  The state container is not answering yet. The resources exist, so nothing\n` +
            `     is lost — a brand-new storage account's blob endpoint can take a few\n` +
            `     minutes. Re-run \`dude iac init --env ${env}\` shortly; if it keeps failing\n` +
            `     with a 404 on ListBlobs, check the account in the portal.\n\n`,
        )
      }
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
