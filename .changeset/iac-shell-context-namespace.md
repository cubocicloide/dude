---
"@cubocicloide/stack-react-fastapi": patch
---

fix(iac): `dude iac shell` pins the kube context + namespace to the target env

`dude iac shell --env <env>` mounted the host `~/.kube` read-only and dropped you
into a shell on whatever your host's *current-context* happened to be — which
might be a different cluster (e.g. another project, or `prod` while you asked for
`dev`). It also opened on the `default` namespace, so `k9s`/`kubectl get pods`
looked empty even when the app was running in the env's namespace.

The shell now builds a dedicated in-container kubeconfig for the env's own
cluster (`aws eks update-kubeconfig` against the mounted credentials) and selects
the env's namespace, so `kubectl`/`helm`/`k9s` target the right cluster + see the
right pods immediately. If the cluster can't be reached (not provisioned yet,
bad creds) it falls back to the mounted `~/.kube` with a warning rather than
silently acting on the wrong cluster.
