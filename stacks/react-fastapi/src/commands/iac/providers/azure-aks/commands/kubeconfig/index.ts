/** `dude iac kubeconfig` — point kubectl at the provisioned AKS cluster. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { projectName, runWith } from '../../../../shared.js'
import { azureEnv, capture } from '../../lib/exec.js'
import {
  TF_DIR,
  envArg,
  hasIac,
  requireEnv,
  requireIac,
  resolveSubscription,
} from '../../lib/terraform.js'

export const iacKubeconfigCommand: StackCommandDef = {
  available: hasIac,
  description: 'Update your kubeconfig to point at the provisioned AKS cluster.',
  args: { ...envArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const subscription = resolveSubscription(projectRoot, args, env)

    // Pull cluster name + resource group from Terraform outputs, falling back to
    // the scaffold's naming convention so this still works before the first
    // apply has produced readable outputs.
    const out = capture(
      'terraform',
      [`-chdir=${TF_DIR}`, 'output', '-json'],
      projectRoot,
      subscription,
    )
    let cluster = ''
    let group = ''
    if (out.status === 0) {
      try {
        const o = JSON.parse(out.stdout) as Record<string, { value?: string }>
        cluster = o.cluster_name?.value ?? ''
        group = o.resource_group_name?.value ?? ''
      } catch {
        /* fall through to the convention below */
      }
    }
    cluster ||= `${projectName(projectRoot)}-${env}`
    group ||= `${projectName(projectRoot)}-${env}-rg`

    // `az` runs on the host so it writes the *host* ~/.kube — the file the
    // runner then mounts, and the one your own kubectl reads.
    process.exit(
      runWith(
        'az',
        [
          'aks',
          'get-credentials',
          '--resource-group',
          group,
          '--name',
          cluster,
          '--overwrite-existing',
        ],
        projectRoot,
        azureEnv(subscription),
      ),
    )
  },
}
