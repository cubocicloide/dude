/**
 * `dude iac shell` — drop into an interactive shell inside the IaC runner
 * container, with terraform + the AWS CLI pre-installed and the environment's
 * AWS profile already wired. Lets a user inspect or tweak an environment by
 * hand without installing any of those tools locally.
 */
import { spawnSync } from 'node:child_process'
import type { StackCommandDef } from '@cubocicloide/dude'
import { dockerAvailable, dockerShellArgs, hasRunnerDockerfile } from '../../lib/runner.js'
import { envArg, hasIac, requireEnv, requireIac, resolveProfile } from '../../lib/terraform.js'

export const iacShellCommand: StackCommandDef = {
  available: hasIac,
  description:
    'Open an interactive shell in the IaC runner container (terraform, aws) scoped to an environment.',
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
          `     Re-scaffold with \`--iac aws-ecs\` or add it to enable the runner.\n\n`,
      )
      process.exit(1)
    }
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)

    process.stdout.write(
      `\n  →  Entering the IaC runner for env "${env}" (profile "${profile}").\n` +
        `     The project is mounted at /work. Type "exit" to leave.\n\n`,
    )
    const r = spawnSync('docker', dockerShellArgs(projectRoot, profile), {
      stdio: 'inherit',
      cwd: projectRoot,
    })
    process.exit(r.status ?? 1)
  },
}
