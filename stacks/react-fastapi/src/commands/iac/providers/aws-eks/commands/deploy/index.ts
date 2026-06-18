/** `dude iac deploy` — release the application with Helm. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { doDeploy, requireEcrRepos, resolveTag, tagArg } from '../../lib/images.js'
import { envArg, hasIac, requireEnv, requireIac, resolveProfile } from '../../lib/terraform.js'

export const iacDeployCommand: StackCommandDef = {
  available: hasIac,
  description:
    'Deploy the application (helm upgrade --install) — auto-wires the ECR registry + image tag.',
  args: {
    ...envArg,
    ...tagArg,
    namespace: { type: 'string', description: 'Kubernetes namespace (default: the environment).' },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)
    const tag = resolveTag(projectRoot, args)
    if (!tag) process.exit(1)
    const repos = requireEcrRepos(projectRoot, profile)
    const ns = String(args.namespace ?? env)
    process.exit(doDeploy(projectRoot, profile, env, ns, tag, repos))
  },
}
