/**
 * `dude iac shell` — drop into an interactive shell inside the IaC runner
 * container, with terraform/kubectl/helm/k9s + the Azure CLI pre-installed and
 * the environment's subscription + cluster already wired. Lets a user inspect or
 * tweak an environment by hand without installing any of those tools locally.
 */
import { spawnSync } from 'node:child_process'
import type { StackCommandDef } from '@cubocicloide/dude'
import { dockerAvailable, dockerShellArgs, hasRunnerDockerfile } from '../../lib/runner.js'
import {
  envArg,
  hasIac,
  kubeTarget,
  requireEnv,
  requireIac,
  resolveSubscription,
} from '../../lib/terraform.js'

export const iacShellCommand: StackCommandDef = {
  available: hasIac,
  description:
    'Open an interactive shell in the IaC runner container (terraform, kubectl, helm, k9s, az) scoped to an environment.',
  args: { ...envArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
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
          `     Re-scaffold with \`--iac azure-aks\` or add it to enable the runner.\n\n`,
      )
      process.exit(1)
    }
    const env = requireEnv(projectRoot, args)
    const subscription = resolveSubscription(projectRoot, args, env)

    // Pin the in-container kubeconfig to THIS env's cluster + namespace so the
    // shell never inherits the host's current-context (which may point at a
    // different cluster). The names follow the scaffold convention; if either is
    // off, the prelude fails to reach the cluster and falls back to the mounted
    // ~/.kube — never silently targeting the wrong one.
    const kube = kubeTarget(projectRoot, env, env)

    process.stdout.write(
      `\n  →  Entering the IaC runner for env "${env}" (cluster "${kube.cluster}").\n` +
        `     The project is mounted at /work. Type "exit" to leave.\n\n`,
    )
    const r = spawnSync('docker', dockerShellArgs(projectRoot, subscription, kube), {
      stdio: 'inherit',
      cwd: projectRoot,
    })
    process.exit(r.status ?? 1)
  },
}
