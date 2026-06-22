/** `dude iac status` — show the deployed release status and pods. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { projectName } from '../../../../shared.js'
import { run } from '../../lib/exec.js'
import {
  envArg,
  hasIac,
  kubeTarget,
  requireEnv,
  requireIac,
  resolveProfile,
} from '../../lib/terraform.js'

export const iacStatusCommand: StackCommandDef = {
  available: hasIac,
  description: 'Show the deployed release status and pods.',
  args: {
    ...envArg,
    namespace: { type: 'string', description: 'Kubernetes namespace (default: the environment).' },
  },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)
    const ns = String(args.namespace ?? env)
    const release = projectName(projectRoot)
    const kube = kubeTarget(projectRoot, env, ns)
    const s = run('helm', ['status', release, '--namespace', ns], projectRoot, profile, kube)
    run('kubectl', ['get', 'pods', '--namespace', ns], projectRoot, profile, kube)
    process.exit(s)
  },
}
