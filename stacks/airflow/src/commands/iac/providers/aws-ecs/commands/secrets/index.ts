/**
 * `dude iac secrets` — manage the environment's application secrets.
 *
 * Terraform provisions one Secrets Manager secret per environment
 * (`<project>/<env>/app`, output `app_secrets_arn`) holding a JSON object of
 * key/value pairs. This command reads and writes that JSON; Terraform injects
 * each key listed in `app_secret_keys` (terraform.tfvars) into every Airflow
 * container as an environment variable of the same name.
 *
 * Workflow for a NEW secret:
 *   1. dude iac secrets --env dev --set SLACK_WEBHOOK=https://…
 *   2. add "SLACK_WEBHOOK" to app_secret_keys in environments/dev/terraform.tfvars
 *   3. dude iac apply --env dev            (wires it into the task definitions)
 *
 * Changing the VALUE of an already-wired key only needs step 1 + `--roll`
 * (ECS injects secrets at container start, so running tasks must be recycled).
 */
import type { StackCommandDef } from '@cubocicloide/dude'
import { capture as awsCapture, run } from '../../../../shared.js'
import { capture } from '../../lib/exec.js'
import {
  TF_DIR,
  envArg,
  hasIac,
  requireEnv,
  requireIac,
  resolveProfile,
} from '../../lib/terraform.js'

interface SecretsTarget {
  arn: string
  region: string
  cluster: string
  services: string[]
}

function readTarget(projectRoot: string, profile: string): SecretsTarget | null {
  const out = capture('terraform', [`-chdir=${TF_DIR}`, 'output', '-json'], projectRoot, profile)
  if (out.status !== 0) return null
  try {
    const o = JSON.parse(out.stdout) as Record<string, { value?: unknown }>
    const arn = String(o.app_secrets_arn?.value ?? '')
    const region = String(o.region?.value ?? '')
    const cluster = String(o.cluster_name?.value ?? '')
    const services = Array.isArray(o.service_names?.value)
      ? (o.service_names!.value as string[]).map(String)
      : []
    if (!arn || !region) return null
    return { arn, region, cluster, services }
  } catch {
    return null
  }
}

function getSecretJson(
  target: SecretsTarget,
  projectRoot: string,
  profile: string,
): Record<string, string> {
  const r = awsCapture(
    'aws',
    [
      'secretsmanager',
      'get-secret-value',
      '--secret-id',
      target.arn,
      '--query',
      'SecretString',
      '--output',
      'text',
      '--region',
      target.region,
    ],
    projectRoot,
    profile,
  )
  if (r.status !== 0) {
    process.stderr.write('\n  ✗  Could not read the app secret (check your AWS auth).\n\n')
    process.exit(1)
  }
  try {
    const parsed = JSON.parse(r.stdout.trim()) as Record<string, unknown>
    return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, String(v)]))
  } catch {
    return {}
  }
}

export const iacSecretsCommand: StackCommandDef = {
  available: hasIac,
  description:
    'List or update the app secrets (Secrets Manager JSON) injected into the Airflow containers as env vars.',
  args: {
    ...envArg,
    set: {
      type: 'string',
      description: 'Set one KEY=VALUE pair (add the key to app_secret_keys in tfvars to wire it).',
      required: false,
    },
    unset: { type: 'string', description: 'Remove a KEY from the secret.', required: false },
    reveal: {
      type: 'boolean',
      description: 'Print secret values, not just the keys.',
      default: false,
    },
    roll: {
      type: 'boolean',
      description:
        'Force a new deployment of the ECS services so running containers pick up changed values.',
      default: false,
    },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)

    const target = readTarget(projectRoot, profile)
    if (!target) {
      process.stderr.write(
        'error: could not read Terraform outputs (app_secrets_arn, region) — run `dude iac apply` first.\n',
      )
      process.exit(1)
    }

    const current = getSecretJson(target, projectRoot, profile)
    let mutated = false

    if (typeof args.set === 'string' && args.set) {
      const eq = args.set.indexOf('=')
      if (eq <= 0) {
        process.stderr.write('\n  ✗  --set expects KEY=VALUE.\n\n')
        process.exit(1)
      }
      const key = args.set.slice(0, eq)
      if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
        process.stderr.write(
          `\n  ✗  invalid key "${key}" (expected an UPPER_SNAKE_CASE env-var name).\n\n`,
        )
        process.exit(1)
      }
      current[key] = args.set.slice(eq + 1)
      mutated = true
      process.stdout.write(`\n  → setting ${key}…\n`)
    }

    if (typeof args.unset === 'string' && args.unset) {
      if (!(args.unset in current)) {
        process.stderr.write(`\n  ✗  key "${args.unset}" not found in the secret.\n\n`)
        process.exit(1)
      }
      delete current[args.unset]
      mutated = true
      process.stdout.write(`\n  → removing ${args.unset}…\n`)
    }

    if (mutated) {
      const w = awsCapture(
        'aws',
        [
          'secretsmanager',
          'put-secret-value',
          '--secret-id',
          target.arn,
          '--secret-string',
          JSON.stringify(current),
          '--region',
          target.region,
        ],
        projectRoot,
        profile,
      )
      if (w.status !== 0) {
        process.stderr.write('\n  ✗  Could not write the secret.\n\n')
        process.exit(1)
      }
      process.stdout.write('  ✓  Secret updated.\n')
    }

    // Always end by listing what the secret holds.
    const keys = Object.keys(current).sort()
    process.stdout.write(`\n  App secret for "${env}" (${keys.length} key${keys.length === 1 ? '' : 's'}):\n`)
    for (const k of keys) {
      process.stdout.write(args.reveal ? `     ${k}=${current[k]}\n` : `     ${k}\n`)
    }
    if (!keys.length) process.stdout.write('     (empty)\n')
    process.stdout.write(
      '\n  Wire a key into the containers by adding it to `app_secret_keys` in\n' +
        `  iac/terraform/environments/${env}/terraform.tfvars, then: dude iac apply --env ${env}\n`,
    )

    if (args.roll) {
      if (!target.cluster || !target.services.length) {
        process.stderr.write('\n  ✗  Could not resolve the ECS services to roll.\n\n')
        process.exit(1)
      }
      for (const svc of target.services) {
        process.stdout.write(`\n  → rolling ${svc}…\n`)
        const code = run(
          'aws',
          [
            'ecs',
            'update-service',
            '--cluster',
            target.cluster,
            '--service',
            svc,
            '--force-new-deployment',
            '--no-cli-pager',
            '--region',
            target.region,
          ],
          projectRoot,
          profile,
        )
        if (code !== 0) process.exit(code)
      }
      process.stdout.write(
        `\n  ✓  Services are restarting with the new values — watch: dude iac status --env ${env}\n\n`,
      )
    } else if (mutated) {
      process.stdout.write(
        '  Already-wired keys need a restart to pick up new values: re-run with --roll.\n\n',
      )
    } else {
      process.stdout.write('\n')
    }
  },
}
