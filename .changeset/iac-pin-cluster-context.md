---
"@cubocicloide/stack-react-fastapi": patch
---

fix(iac): pin the cluster context for `status`/`deploy`/`destroy`, not just `shell`

The containerized `kubectl`/`helm` calls behind `dude iac status`, `deploy` and
`destroy` inherited the host's kubectl *current-context*. In the normal flow
(you just ran `dude iac kubeconfig --env <env>`) that's the right cluster, but if
your current-context was left on another project/env, those commands silently
acted on the wrong cluster.

`run`/`capture` now take an optional `kube` target ({cluster, region, namespace}).
When routing a kube tool through the runner, the invocation is wrapped in a
prelude that builds a dedicated in-container kubeconfig for that exact cluster
(`aws eks update-kubeconfig`) and selects the namespace — so `status`/`deploy`/
`destroy` always target the env named by `--env`. The prelude is silent on
stdout (so captured output stays clean) and, if the cluster is unreachable,
falls back to the mounted `~/.kube` with a stderr warning rather than guessing.

The cluster name follows the scaffold convention (`<project>-<env>`); the region
comes from the env's tfvars. The native fallback path (`DUDE_IAC_RUNNER=host` or
no Docker) is unchanged — it still uses the host kubeconfig as-is.
