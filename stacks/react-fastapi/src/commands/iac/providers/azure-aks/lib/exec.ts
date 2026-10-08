/**
 * `run` / `capture` for the AKS provider: the shared Azure helpers, with the
 * `kube` argument translated into the bash prelude that pins a containerized
 * kube tool to this environment's cluster.
 */
import { capture as baseCapture, run as baseRun, type CaptureResult } from '../../../azure/exec.js'
import { kubePrelude, type KubeTarget } from './runner.js'

export { azureEnv } from '../../../azure/exec.js'
export type { CaptureResult, KubeTarget }

/** See `iac/azure/exec.ts`. `kube` pins kubectl/helm/k9s to the env's cluster. */
export function run(
  cmd: string,
  args: string[],
  cwd: string,
  subscription?: string,
  kube?: KubeTarget,
): number {
  return baseRun(cmd, args, cwd, subscription, kubePrelude(kube, false))
}

/** See `run`. */
export function capture(
  cmd: string,
  args: string[],
  cwd: string,
  subscription?: string,
  kube?: KubeTarget,
): CaptureResult {
  return baseCapture(cmd, args, cwd, subscription, kubePrelude(kube, false))
}
