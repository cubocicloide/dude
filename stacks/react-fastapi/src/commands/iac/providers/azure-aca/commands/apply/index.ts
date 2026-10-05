/**
 * `dude iac apply` — provision/update the infrastructure for an environment.
 *
 * Not the shared implementation, because Container Apps **validates that the
 * image exists** when it creates an app: unlike a Kubernetes Deployment, which
 * is accepted and then sits in ImagePullBackOff, an app whose tag is not in the
 * registry fails the apply outright with a wall of
 * `InvalidParameterValueInContainerTemplate` text that never mentions the real
 * problem. So the tag is checked first, and the fix is spelled out.
 */
import type { StackCommandDef } from '@cubocicloide/dude'
import { imagesPublished, requireAcrRepos } from '../../lib/images.js'
import {
  envArg,
  hasIac,
  requireEnv,
  requireIac,
  resolveSubscription,
  tf,
  tfvarsValue,
  varFile,
} from '../../lib/terraform.js'

export const iacApplyCommand: StackCommandDef = {
  available: hasIac,
  description: 'Provision/update the infrastructure for an environment.',
  args: {
    ...envArg,
    yes: { type: 'boolean', description: 'Skip the interactive approval (-auto-approve).' },
    'skip-image-check': {
      type: 'boolean',
      description:
        'Apply even though the configured image_tag is not in the registry (it will fail unless Azure can pull it).',
    },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const subscription = resolveSubscription(projectRoot, args, env)

    if (!args['skip-image-check']) {
      const tag = tfvarsValue(projectRoot, env, 'image_tag') || 'latest'
      const repos = requireAcrRepos(projectRoot, subscription, env)
      if (!imagesPublished(projectRoot, subscription, tag, repos)) {
        process.stderr.write(
          `\n  ✗  The images tagged "${tag}" are not in ${repos.registryHost}, and Container\n` +
            `     Apps refuses to create an app whose image it cannot pull.\n\n` +
            `     On a first deploy this is expected — there is nothing published yet.\n` +
            `     Use ship, which builds and pushes before applying:\n\n` +
            `       dude iac ship --env ${env}\n\n` +
            `     To provision infrastructure only, past that point:\n` +
            `       dude iac apply --env ${env} --skip-image-check\n\n`,
        )
        process.exit(1)
      }
    }

    const extra = args.yes ? ['-auto-approve'] : []
    process.exit(tf(projectRoot, ['apply', varFile(env), ...extra], subscription))
  },
}
