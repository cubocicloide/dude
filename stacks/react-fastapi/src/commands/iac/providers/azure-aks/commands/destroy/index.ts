/**
 * `dude iac destroy` — tear down everything for an environment.
 *
 * Order matters, but far less than on AWS: the Azure load balancer and public IP
 * that front the cluster are created by the in-cluster cloud-controller from the
 * ingress Service, and are deleted with the AKS cluster's own node resource
 * group — so there is no orphaned-ALB class of failure to clean up after. What
 * does need sequencing is the Helm release (uninstalled first, so the ingress
 * controller can release the public IP cleanly) and the shared bootstrap (state
 * storage + registry), which lives outside the per-env Terraform and is torn
 * down last, and only when no sibling environment still depends on it.
 */
import type { StackCommandDef } from '@cubocicloide/dude'
import { projectName } from '../../../../shared.js'
import { capture, run } from '../../lib/exec.js'
import { bootstrapStateIsEmpty, envStateLiveness, resourceGroupExists } from '../../lib/azure.js'
import {
  envArg,
  hasIac,
  kubeTarget,
  listEnvironments,
  readBackend,
  requireEnv,
  requireIac,
  resolveSubscription,
  tf,
  tfBoot,
  tfOutputRaw,
  varFile,
} from '../../lib/terraform.js'

export const iacDestroyCommand: StackCommandDef = {
  available: hasIac,
  description:
    'Tear down everything for an environment: uninstall the Helm release, destroy the Terraform infrastructure (resource group, AKS, database), then destroy the shared bootstrap (state storage account + container registry). Use --keep-backend to preserve the shared resources.',
  args: {
    ...envArg,
    yes: { type: 'boolean', description: 'Skip the interactive approval (-auto-approve).' },
    namespace: {
      type: 'string',
      description: 'Kubernetes namespace the release lives in (default: the environment).',
    },
    'skip-helm': {
      type: 'boolean',
      description: 'Skip the Helm uninstall step — use when the release is already gone.',
    },
    'keep-backend': {
      type: 'boolean',
      description:
        'Keep the shared bootstrap (Terraform state storage account + container registry). It is kept automatically while any other environment still uses it; pass this to force-keep it even when destroying the last environment.',
    },
    'skip-tf': {
      type: 'boolean',
      description:
        'Skip the Terraform destroy of the environment — only run the Helm uninstall (and the bootstrap teardown unless --keep-backend).',
    },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const subscription = resolveSubscription(projectRoot, args, env)
    const ns = String(args.namespace ?? env)
    const release = projectName(projectRoot)
    const kube = kubeTarget(projectRoot, env, ns)
    const extra = args.yes ? ['-auto-approve'] : []

    // ── Step 1: uninstall the Helm release ───────────────────────────────────
    if (!args['skip-helm']) {
      const helmCheck = capture(
        'helm',
        ['status', release, '--namespace', ns],
        projectRoot,
        subscription,
        kube,
      )
      if (helmCheck.status === 0) {
        process.stdout.write(
          `\n  → uninstalling Helm release "${release}" from namespace "${ns}"…\n`,
        )
        const code = run(
          'helm',
          ['uninstall', release, '--namespace', ns],
          projectRoot,
          subscription,
          kube,
        )
        if (code !== 0) {
          process.stderr.write(
            '\n  ✗  Helm uninstall failed. Retry or re-run with --skip-helm if you removed it manually.\n\n',
          )
          process.exit(code)
        }
        // Wait for the Ingress to disappear (--for=delete exits 0 when already gone).
        process.stdout.write('  → waiting for the Ingress to be removed…\n')
        run(
          'kubectl',
          ['wait', '--for=delete', `ingress/${release}`, '--namespace', ns, '--timeout=3m'],
          projectRoot,
          subscription,
          kube,
        )
      } else {
        process.stdout.write(
          `  ↷  Helm release "${release}" not found in namespace "${ns}", skipping uninstall.\n`,
        )
      }
    }

    // ── Step 2: destroy the environment's Terraform infrastructure ───────────
    const resourceGroup =
      tfOutputRaw(projectRoot, 'resource_group_name', subscription) || `${release}-${env}-rg`

    if (!args['skip-tf']) {
      process.stdout.write(`\n  → destroying the "${env}" infrastructure…\n`)
      const code = tf(projectRoot, ['destroy', varFile(env), ...extra], subscription)
      if (code !== 0) process.exit(code)

      // Terraform returning 0 is not the same as Azure having finished: a group
      // whose deletion is still in flight, or held by a resource lock, keeps
      // billing. Say so rather than reporting a clean teardown.
      if (resourceGroupExists(resourceGroup, projectRoot, subscription)) {
        process.stderr.write(
          `\n  ⚠  Resource group "${resourceGroup}" still exists.\n` +
            '     Azure may still be deleting it (this can take several minutes), or a\n' +
            '     resource lock is blocking it. Check with:\n' +
            `       az group show --name ${resourceGroup} --query properties.provisioningState -o tsv\n\n`,
        )
      }
    }

    // ── Step 3: tear down the shared bootstrap ───────────────────────────────
    if (args['keep-backend']) {
      process.stdout.write('  ↷  Keeping the shared state storage + registry (--keep-backend). Done.\n\n')
      process.exit(0)
    }

    // Names come from backend.hcl, not `terraform output` (which returns nothing
    // once an output references an already-destroyed resource).
    const backend = readBackend(projectRoot, env)
    if (!backend.storageAccount) {
      process.stdout.write('  ↷  No shared backend configured to tear down. Done.\n\n')
      process.exit(0)
    }

    // Safety guard: the bootstrap owns the project-wide SHARED resources — the
    // state storage account AND the container registry — used by every
    // environment (they differ only by their state blob `key`). Tearing it down
    // would wipe the OTHER envs' state and delete the registry they still deploy
    // from, so if any sibling env is STILL PROVISIONED we keep it and stop.
    //
    // Liveness is read from each sibling's remote *state* — NOT from the presence
    // of its folder on disk: a folder survives a `terraform destroy`, so a
    // disk-based check would see an already-torn-down `staging` and refuse to
    // ever tear the backend down. The state blob, by contrast, has an empty
    // `resources` array once the env is destroyed.
    const siblings = listEnvironments(projectRoot).filter(
      (e) => e !== env && readBackend(projectRoot, e).storageAccount === backend.storageAccount,
    )
    const live: string[] = []
    if (siblings.length) {
      process.stdout.write(`  → checking sibling environments on this backend…\n`)
      for (const e of siblings) {
        const b = readBackend(projectRoot, e)
        const { live: isLive, reason } = envStateLiveness(
          b.storageAccount,
          b.container,
          b.key,
          projectRoot,
          subscription,
        )
        process.stdout.write(`     • ${e}: ${isLive ? 'still live' : 'not live'} — ${reason}\n`)
        if (isLive) live.push(e)
      }
    }
    if (live.length) {
      process.stdout.write(
        `\n  ↷  Keeping the shared state storage + registry — still used by: ${live.join(', ')}.\n` +
          `     Destroying them would wipe their state and registry. Destroy those\n` +
          `     environments first, or pass --keep-backend. Done.\n\n`,
      )
      process.exit(0)
    }

    process.stdout.write(
      `\n  → tearing down the shared bootstrap (state storage + container registry)…\n` +
        `     resource group: ${backend.resourceGroup || '(none)'}   storage: ${backend.storageAccount}\n`,
    )
    // Bootstrap keeps local state — make sure it's initialised, then destroy.
    tfBoot(projectRoot, ['init', '-input=false'], subscription)
    const bootCode = tfBoot(projectRoot, ['destroy', ...extra], subscription)
    if (bootCode !== 0) {
      process.stderr.write(
        '\n  ✗  Could not destroy the shared bootstrap. Inspect it with:\n' +
          `       az group show --name ${backend.resourceGroup}\n\n`,
      )
      process.exit(bootCode)
    }

    if (resourceGroupExists(backend.resourceGroup, projectRoot, subscription)) {
      process.stderr.write(
        bootstrapStateIsEmpty(projectRoot)
          ? `\n  ✗  Shared resource group "${backend.resourceGroup}" still exists, and the\n` +
              `     bootstrap's Terraform state is empty — so the destroy above had nothing\n` +
              `     to act on.\n\n` +
              `     The bootstrap keeps LOCAL state (it is what creates the remote backend,\n` +
              `     so it cannot use it) and iac/.gitignore excludes *.tfstate. That state\n` +
              `     therefore exists only where \`dude iac bootstrap\` was run: a fresh clone,\n` +
              `     a re-scaffold or a teammate's machine all start empty.\n\n` +
              `     Remove the shared resources directly:\n` +
              `       az group delete --name ${backend.resourceGroup} --yes\n\n`
          : `\n  ⚠  Shared resource group "${backend.resourceGroup}" still exists — Azure may\n` +
              '     still be deleting it. Re-check in a few minutes.\n\n',
      )
      process.exit(1)
    }
    process.stdout.write('  ✓  Shared bootstrap removed.\n\n')
    process.exit(0)
  },
}
