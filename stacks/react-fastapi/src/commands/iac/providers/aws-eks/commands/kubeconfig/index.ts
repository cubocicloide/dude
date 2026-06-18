/** `dude iac kubeconfig` — point kubectl at the provisioned EKS cluster. */
import type { StackCommandDef } from '@cubocicloide/dude'
import { capture, run } from '../../../../shared.js'
import { TF_DIR, envArg, hasIac, requireEnv, requireIac, resolveProfile } from '../../lib/terraform.js'

export const iacKubeconfigCommand: StackCommandDef = {
  available: hasIac,
  description: 'Update your kubeconfig to point at the provisioned EKS cluster.',
  args: { ...envArg },
  async run({ projectRoot, args }) {
    if (!requireIac(projectRoot)) process.exit(1)
    const env = requireEnv(projectRoot, args)
    const profile = resolveProfile(projectRoot, args, env)
    // Pull cluster name + region from Terraform outputs.
    const out = capture('terraform', [`-chdir=${TF_DIR}`, 'output', '-json'], projectRoot, profile)
    if (out.status !== 0) {
      process.stderr.write('error: could not read Terraform outputs — run `dude iac apply` first.\n')
      process.exit(1)
    }
    let cluster = ''
    let region = ''
    try {
      const o = JSON.parse(out.stdout) as Record<string, { value?: string }>
      cluster = o.cluster_name?.value ?? ''
      region = o.region?.value ?? ''
    } catch {
      /* fall through to the error below */
    }
    if (!cluster || !region) {
      process.stderr.write('error: outputs `cluster_name`/`region` not found.\n')
      process.exit(1)
    }
    process.exit(
      run('aws', ['eks', 'update-kubeconfig', '--name', cluster, '--region', region], projectRoot, profile),
    )
  },
}
