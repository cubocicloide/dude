/**
 * The `dude iac` commands that are identical across Azure targets.
 *
 * Twelve of the eighteen commands differ between the AKS and Container Apps
 * targets only in which project they refuse to run in — the Terraform
 * lifecycle (`init`/`plan`/`apply`/`output`/`fmt`/`validate`), signing in,
 * creating the shared bootstrap, scaffolding an environment, building and
 * pushing images, and opening the runner shell are the same work either way.
 * They are defined once here and bound to a target through {@link AzureTarget}.
 *
 * What is NOT here is everything that depends on how a target *runs* the
 * application: `deploy`, `ship`, `status`, `destroy`, and the per-target extras
 * (`kubeconfig` on AKS, `logs`/`migrate` on Container Apps). Those live with
 * their provider, because sharing them would mean a config object with a branch
 * for every difference — which is the duplication back again, just less legible.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'pathe'
import type { StackCommandDef } from '@cubocicloide/dude'
import { captureWith, projectName, runWith, sleepMs } from '../shared.js'
import { capture } from './exec.js'
import { doBuild, doPush, platformArg, requireAcrRepos, resolveTag, tagArg, warnTagExists } from './acr.js'
import { dockerAvailable, dockerShellArgs, hasRunnerDockerfile } from './runner.js'
import {
  TF_BOOTSTRAP_DIR,
  TF_DIR,
  TF_ENVIRONMENTS_DIR,
  backendConfig,
  captureBootstrap,
  envArg,
  listEnvironments,
  requireEnv,
  resolveSubscription,
  tf,
  tfBoot,
  tfvarsValue,
  varFile,
} from './terraform.js'

/** What a provider must tell these shared commands about itself. */
export interface AzureTarget {
  /** Stable id, matching the `iac` scaffold answer (e.g. `azure-aca`). */
  id: string
  /** True when this provider is the one configured for the project. */
  hasIac: (projectRoot: string) => boolean
  /** Guard that prints the standard "wrong/no target" message. */
  requireIac: (projectRoot: string) => boolean
  /** Extra rewrites `new-env` applies to the copied environment's tfvars. */
  rewriteEnvTfvars?: (tfvars: string, env: string, project: string) => string
  /** Bash run inside the runner before an interactive shell starts. */
  shellPrelude?: (projectRoot: string, env: string) => string[] | undefined
  /** Tools the shell banner advertises, e.g. 'terraform, kubectl, helm, k9s, az'. */
  shellTools: string
}

// ── Terraform lifecycle ───────────────────────────────────────────────────────

export function defineAzureInit(t: AzureTarget): StackCommandDef {
  return {
    available: t.hasIac,
    description:
      'Initialise Terraform for an environment (configures the Azure Storage remote backend).',
    args: { ...envArg },
    async run({ projectRoot, args }) {
      if (!t.requireIac(projectRoot)) process.exit(1)
      const env = requireEnv(projectRoot, args)
      const subscription = resolveSubscription(projectRoot, args, env)
      // All environments share one `iac/terraform` directory (and thus one
      // `.terraform` backend cache), but each has its own remote state (distinct
      // blob key in its backend.hcl). `-reconfigure` repoints the backend at the
      // requested env's state without trying to migrate the previous env's state
      // into it — switching envs would otherwise fail with "Backend configuration
      // changed". State is never shared between envs, so migration is never wanted.
      process.exit(tf(projectRoot, ['init', '-reconfigure', backendConfig(env)], subscription))
    },
  }
}

export function defineAzurePlan(t: AzureTarget): StackCommandDef {
  return {
    available: t.hasIac,
    description: 'Show the infrastructure changes Terraform would apply for an environment.',
    args: { ...envArg },
    async run({ projectRoot, args }) {
      if (!t.requireIac(projectRoot)) process.exit(1)
      const env = requireEnv(projectRoot, args)
      const subscription = resolveSubscription(projectRoot, args, env)
      process.exit(tf(projectRoot, ['plan', varFile(env)], subscription))
    },
  }
}

export function defineAzureApply(t: AzureTarget): StackCommandDef {
  return {
    available: t.hasIac,
    description: 'Provision/update the infrastructure for an environment.',
    args: {
      ...envArg,
      yes: { type: 'boolean', description: 'Skip the interactive approval (-auto-approve).' },
    },
    async run({ projectRoot, args }) {
      if (!t.requireIac(projectRoot)) process.exit(1)
      const env = requireEnv(projectRoot, args)
      const subscription = resolveSubscription(projectRoot, args, env)
      const extra = args.yes ? ['-auto-approve'] : []
      process.exit(tf(projectRoot, ['apply', varFile(env), ...extra], subscription))
    },
  }
}

export function defineAzureOutput(t: AzureTarget): StackCommandDef {
  return {
    available: t.hasIac,
    description:
      'Print Terraform outputs for an environment (registry URLs, app URL, database endpoint…).',
    args: { ...envArg, json: { type: 'boolean', description: 'Emit machine-readable JSON.' } },
    async run({ projectRoot, args }) {
      if (!t.requireIac(projectRoot)) process.exit(1)
      const env = requireEnv(projectRoot, args)
      const subscription = resolveSubscription(projectRoot, args, env)
      process.exit(tf(projectRoot, ['output', ...(args.json ? ['-json'] : [])], subscription))
    },
  }
}

export function defineAzureFmt(t: AzureTarget): StackCommandDef {
  return {
    available: t.hasIac,
    description: 'Format all Terraform files (terraform fmt -recursive).',
    async run({ projectRoot }) {
      if (!t.requireIac(projectRoot)) process.exit(1)
      process.exit(tf(projectRoot, ['fmt', '-recursive']))
    },
  }
}

export function defineAzureValidate(t: AzureTarget): StackCommandDef {
  return {
    available: t.hasIac,
    description: 'Validate the Terraform configuration.',
    async run({ projectRoot }) {
      if (!t.requireIac(projectRoot)) process.exit(1)
      process.exit(tf(projectRoot, ['validate']))
    },
  }
}

// ── Images ────────────────────────────────────────────────────────────────────

export function defineAzureBuild(t: AzureTarget): StackCommandDef {
  return {
    available: t.hasIac,
    description: 'Build the backend + frontend production images, tagged for the env registry.',
    args: { ...envArg, ...tagArg, ...platformArg },
    async run({ projectRoot, args }) {
      if (!t.requireIac(projectRoot)) process.exit(1)
      const env = requireEnv(projectRoot, args)
      const subscription = resolveSubscription(projectRoot, args, env)
      const tag = resolveTag(projectRoot, args)
      if (!tag) process.exit(1)
      const repos = requireAcrRepos(projectRoot, subscription)
      const platform = String(args.platform ?? 'linux/amd64')
      process.exit(
        doBuild(projectRoot, subscription, tag, repos, projectName(projectRoot), platform),
      )
    },
  }
}

export function defineAzurePush(t: AzureTarget): StackCommandDef {
  return {
    available: t.hasIac,
    description: 'Log in to the registry and push the backend + frontend images (build them first).',
    args: { ...envArg, ...tagArg },
    async run({ projectRoot, args }) {
      if (!t.requireIac(projectRoot)) process.exit(1)
      const env = requireEnv(projectRoot, args)
      const subscription = resolveSubscription(projectRoot, args, env)
      const tag = resolveTag(projectRoot, args)
      if (!tag) process.exit(1)
      const repos = requireAcrRepos(projectRoot, subscription)
      warnTagExists(projectRoot, subscription, tag, repos)
      process.exit(doPush(projectRoot, subscription, tag, repos))
    },
  }
}

// ── Authentication ────────────────────────────────────────────────────────────

export function defineAzureLogin(t: AzureTarget): StackCommandDef {
  return {
    available: t.hasIac,
    description:
      'Sign in to Azure and verify the subscription an environment deploys into (runs az login when needed).',
    args: { ...envArg },
    async run({ projectRoot, args }) {
      if (!t.requireIac(projectRoot)) process.exit(1)
      const env = requireEnv(projectRoot, args)

      // Everything here runs natively, never through the IaC runner: `az login`
      // opens a browser, and the token it writes into ~/.azure is what every later
      // containerized command reads through the mounted profile.
      const signedIn =
        captureWith('az', ['account', 'show', '--output', 'none'], projectRoot, process.env)
          .status === 0
      if (!signedIn) {
        process.stdout.write('\n  You are not signed in to Azure. Opening the login flow…\n\n')
        const code = runWith('az', ['login'], projectRoot, process.env)
        if (code !== 0) {
          process.stderr.write(
            '\n  ✗  az login failed.\n' +
              '     On a machine without a browser, run: az login --use-device-code\n\n',
          )
          process.exit(code)
        }
      }

      // Resolve AFTER logging in: with no prior session, `az account show` can't
      // supply the fallback subscription, so resolving first would come back empty
      // for a user who pinned nothing in tfvars.
      const subscription = resolveSubscription(projectRoot, args, env)
      if (!subscription) {
        process.stderr.write(
          '\n  ✗  No Azure subscription could be resolved for this environment.\n' +
            '     Pass --subscription <id>, or set subscription_id in\n' +
            `     iac/terraform/environments/${env}/terraform.tfvars.\n` +
            '     List the ones you can see with: az account list --output table\n\n',
        )
        process.exit(1)
      }

      const who = captureWith(
        'az',
        ['account', 'show', '--subscription', subscription, '--output', 'json'],
        projectRoot,
        process.env,
      )
      if (who.status !== 0) {
        process.stderr.write(
          `\n  ✗  Subscription "${subscription}" is not accessible with your current Azure login.\n` +
            '     Check the id, or sign in with the right tenant:\n' +
            '       az login --tenant <tenant-id>\n\n',
        )
        process.exit(1)
      }
      let name = ''
      let user = ''
      let tenant = ''
      try {
        const o = JSON.parse(who.stdout) as {
          name?: string
          tenantId?: string
          user?: { name?: string }
        }
        name = o.name ?? ''
        tenant = o.tenantId ?? ''
        user = o.user?.name ?? ''
      } catch {
        /* non-fatal — access already verified by the exit status above */
      }

      const pinned = tfvarsValue(projectRoot, env, 'subscription_id')
      const pinNote = pinned
        ? ''
        : `\n  Tip: pin this subscription for the environment by setting\n` +
          `       subscription_id = "${subscription}"\n` +
          `       in iac/terraform/environments/${env}/terraform.tfvars\n`

      process.stdout.write(
        `\n  ✓  Authenticated for env "${env}".\n` +
          `     subscription: ${name || subscription}\n` +
          `     id:           ${subscription}\n` +
          `     tenant:       ${tenant}\n` +
          `     user:         ${user}\n` +
          pinNote +
          `\n  Now: dude iac plan --env ${env}\n\n`,
      )
    },
  }
}

// ── Environments ──────────────────────────────────────────────────────────────

export function defineAzureNewEnv(t: AzureTarget): StackCommandDef {
  return {
    available: t.hasIac,
    description:
      'Scaffold a new environment (iac/terraform/environments/<name>) by copying an existing one.',
    args: {
      env: {
        type: 'string',
        description: 'Name of the new environment to create (lowercase kebab-case).',
        required: true,
      },
      from: {
        type: 'string',
        description: 'Existing environment to copy as a starting point (default: dev).',
      },
    },
    async run({ projectRoot, args }) {
      if (!t.requireIac(projectRoot)) process.exit(1)

      const name = args.env == null ? '' : String(args.env)
      if (!name) {
        process.stderr.write(
          '\n  ✗  --env is required (the name of the environment to create).\n\n',
        )
        process.exit(1)
      }
      if (!/^[a-z][a-z0-9-]*$/.test(name)) {
        process.stderr.write(`\n  ✗  invalid --env "${name}" (expected lowercase kebab-case).\n\n`)
        process.exit(1)
      }

      const envs = listEnvironments(projectRoot)
      if (envs.includes(name)) {
        process.stderr.write(`\n  ✗  environment "${name}" already exists.\n\n`)
        process.exit(1)
      }
      if (!envs.length) {
        process.stderr.write(
          '\n  ✗  no existing environment to copy from (expected at least iac/terraform/environments/dev).\n\n',
        )
        process.exit(1)
      }

      const from = args.from == null ? 'dev' : String(args.from)
      if (!envs.includes(from)) {
        process.stderr.write(
          `\n  ✗  --from "${from}" does not exist. Available: ${envs.join(', ')}\n\n`,
        )
        process.exit(1)
      }

      const base = path.join(projectRoot, TF_ENVIRONMENTS_DIR)
      const dst = path.join(base, name)
      cpSync(path.join(base, from), dst, { recursive: true })

      const project = projectName(projectRoot)

      const tfvarsPath = path.join(dst, 'terraform.tfvars')
      let tfvars = readFileSync(tfvarsPath, 'utf8')
      tfvars = tfvars.replace(/^(\s*environment\s*=\s*).*$/m, `$1"${name}"`)
      // A fresh environment must not inherit the source environment's published
      // image tag: it would come up serving whatever that env last deployed,
      // before anyone ran `dude iac ship` against it.
      tfvars = tfvars.replace(/^(\s*image_tag\s*=\s*).*$/m, `$1"latest"`)
      if (t.rewriteEnvTfvars) tfvars = t.rewriteEnvTfvars(tfvars, name, project)
      writeFileSync(tfvarsPath, tfvars)

      // Reuse the same storage account + container (the state backend is shared
      // across environments); only the state key differs per environment.
      const backendPath = path.join(dst, 'backend.hcl')
      writeFileSync(
        backendPath,
        readFileSync(backendPath, 'utf8').replace(
          /^(\s*key\s*=\s*).*$/m,
          `$1"${project}/${name}/terraform.tfstate"`,
        ),
      )

      process.stdout.write(
        `\n  ✓  Created environment "${name}" (copied from "${from}").\n` +
          `     iac/terraform/environments/${name}/{backend.hcl,terraform.tfvars}\n` +
          `\n  Next:\n` +
          `     1. Review iac/terraform/environments/${name}/terraform.tfvars (sizing, …).\n` +
          `     2. First env on a brand-new state backend? Run:\n` +
          `        dude iac bootstrap --env ${name} --state-prefix <prefix>\n` +
          `        Otherwise it reuses the existing storage account — skip bootstrap.\n` +
          `     3. dude iac init --env ${name} && dude iac apply --env ${name}\n\n`,
      )
    },
  }
}

// ── Shared bootstrap (state storage account + container registry) ─────────────

/** Replace `key = "..."` in an HCL-ish file, appending the line when absent. */
function setHclScalar(text: string, key: string, value: string): string {
  const line = `${key} = "${value}"`
  const re = new RegExp(`^\\s*${key}\\s*=\\s*".*"\\s*$`, 'm')
  return re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`
}

export function defineAzureBootstrap(t: AzureTarget): StackCommandDef {
  return {
    available: t.hasIac,
    description:
      'One-time: create the shared resource group, Terraform state storage account and container registry, then write their names into the environment config.',
    args: {
      location: {
        type: 'string',
        description: 'Azure region for the shared resources.',
        default: 'northeurope',
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
      if (!t.requireIac(projectRoot)) process.exit(1)
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

      const location = String(args.location ?? 'northeurope')
      if (!/^[a-z][a-z0-9]+$/.test(location)) {
        process.stderr.write(
          `\n  ✗  invalid --location "${location}" (expected e.g. northeurope, eastus).\n` +
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
      status = tfBoot(
        projectRoot,
        ['apply', ...(args.yes ? ['-auto-approve'] : [])],
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
      //    Creating the account and the container returns long before the
      //    account's blob endpoint is reachable, and the very next command a user
      //    runs — `dude iac init` — lists blobs to enumerate workspaces. It then
      //    fails with a bare `ListBlobs: 404 ResourceNotFound`, which reads like
      //    the container was never created rather than "try again in a minute".
      //
      //    The probe mirrors what Terraform does: listing CONTAINERS succeeds well
      //    before listing BLOBS inside one does, so checking the container exists
      //    is not enough.
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
}

// ── Runner shell ──────────────────────────────────────────────────────────────

export function defineAzureShell(t: AzureTarget): StackCommandDef {
  return {
    available: t.hasIac,
    description: `Open an interactive shell in the IaC runner container (${t.shellTools}) scoped to an environment.`,
    args: { ...envArg },
    async run({ projectRoot, args }) {
      if (!t.requireIac(projectRoot)) process.exit(1)
      if (!dockerAvailable()) {
        process.stderr.write(
          '\n  ✗  Docker is required for `dude iac shell` (it runs the IaC toolchain in a container).\n' +
            '     Start Docker and retry.\n\n',
        )
        process.exit(1)
      }
      if (!hasRunnerDockerfile(projectRoot)) {
        process.stderr.write(
          `\n  ✗  No runner Dockerfile found (iac/runner/Dockerfile).\n` +
            `     Re-scaffold with \`--iac ${t.id}\` or add it to enable the runner.\n\n`,
        )
        process.exit(1)
      }
      const env = requireEnv(projectRoot, args)
      const subscription = resolveSubscription(projectRoot, args, env)

      process.stdout.write(
        `\n  →  Entering the IaC runner for env "${env}".\n` +
          `     The project is mounted at /work. Type "exit" to leave.\n\n`,
      )
      const r = spawnSync(
        'docker',
        dockerShellArgs(projectRoot, subscription, t.shellPrelude?.(projectRoot, env)),
        { stdio: 'inherit', cwd: projectRoot },
      )
      process.exit(r.status ?? 1)
    },
  }
}
