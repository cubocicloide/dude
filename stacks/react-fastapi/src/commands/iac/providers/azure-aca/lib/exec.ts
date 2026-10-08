/**
 * `run` / `capture` for the Container Apps provider — the shared Azure helpers
 * unchanged. Unlike the Kubernetes target there is no per-command setup to
 * inject: `az` talks to Container Apps directly, with no cluster context to pin.
 */
export { azureEnv, capture, run, type CaptureResult } from '../../../azure/exec.js'
