/** `dude iac login` — sign in to Azure and verify the environment's subscription. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { captureWith, runWith } from '../../../../shared.js'
import {
  envArg,
  hasIac,
  requireEnv,
  requireIac,
  resolveSubscription,
  tfvarsValue,
} from '../../lib/terraform.js'

export const iacLoginCommand: StackCommandDef = {
  available: hasIac,
  description:
    'Sign in to Azure and verify the subscription an environment deploys into (runs az login when needed).',
  args: { ...envArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)

    // Everything here runs natively, never through the IaC runner: `az login`
    // opens a browser, and the token it writes into ~/.azure is what every later
    // containerized command reads through the mounted profile.
    const signedIn =
      captureWith('az', ['account', 'show', '--output', 'none'], projectRoot, process.env).status ===
      0
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
