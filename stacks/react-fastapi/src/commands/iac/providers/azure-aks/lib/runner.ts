/**
 * The AKS-specific part of the Docker runner: pointing a containerized kube tool
 * at the environment's cluster. The container plumbing itself is shared — see
 * `iac/azure/runner.ts`.
 */
import { dockerShellArgs as baseShellArgs, shq } from '../../../azure/runner.js'

export { dockerAvailable, hasRunnerDockerfile, useRunner, CONTAINERIZED } from '../../../azure/runner.js'

/** The cluster a kube tool (kubectl/helm/k9s) should target inside the runner. */
export interface KubeTarget {
  cluster: string
  resourceGroup: string
  namespace: string
}

/**
 * Bash lines that build a *dedicated* kubeconfig for the target cluster (via
 * `az aks get-credentials` against the mounted credentials) and select its
 * namespace — so a containerized kube tool targets exactly the env's cluster
 * rather than silently inheriting the host's current-context (which may point at
 * a different cluster). On failure (cluster not provisioned, bad credentials) it
 * unsets KUBECONFIG and falls back to the mounted ~/.kube. `verbose` prints a
 * friendly banner for the interactive shell; one-shot commands stay quiet on
 * stdout (so `capture` output isn't polluted) and only warn on stderr.
 */
export function kubePrelude(t: KubeTarget | undefined, verbose: boolean): string[] | undefined {
  if (!t?.cluster || !t?.resourceGroup) return undefined
  const lines = [
    'export KUBECONFIG=/tmp/dude-kubeconfig',
    `if az aks get-credentials --resource-group ${shq(t.resourceGroup)} --name ${shq(t.cluster)} --file "$KUBECONFIG" --overwrite-existing >/dev/null 2>&1; then`,
    `  kubectl config set-context --current --namespace=${shq(t.namespace)} >/dev/null 2>&1`,
  ]
  if (verbose) lines.push(`  echo "  ✓  context → ${t.cluster}   namespace → ${t.namespace}"; echo`)
  lines.push('else', '  unset KUBECONFIG')
  lines.push(
    verbose
      ? `  echo "  ⚠  couldn't reach cluster ${t.cluster} — using your mounted ~/.kube as-is."; echo`
      : `  echo "dude: couldn't target cluster ${t.cluster}; using the mounted kubeconfig as-is." >&2`,
  )
  lines.push('fi')
  return lines
}

/**
 * An interactive shell in the runner, opened with kubectl/helm/k9s already
 * pointed at this environment's cluster and namespace.
 */
export function dockerShellArgs(
  projectRoot: string,
  subscription: string | undefined,
  kube?: KubeTarget,
): string[] {
  return baseShellArgs(projectRoot, subscription, kubePrelude(kube, true))
}
