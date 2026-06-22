---
"@cubocicloide/stack-react-fastapi": minor
---

feat(iac): run the IaC toolchain in a Docker runner + add `dude iac shell`

`dude iac *` shelled out to terraform/kubectl/helm/k9s on the host, forcing the
customer to install and version-match all of them — a portability and
reproducibility problem across operating systems.

These tools now run inside a pinned container built from the scaffold's own
`iac/runner/Dockerfile` (customer-owned and editable; the image is tagged by a
hash of that file, so any edit rebuilds automatically). Routing is transparent:
a provider-local `exec.ts` wraps the generic `run`/`capture` and rewrites
containerized-tool invocations into `docker run …`, mounting the working
directory at `/work` so the relative paths the commands already use resolve
unchanged. Credentials are never baked in — `~/.aws` (profiles + SSO cache) and
`~/.kube` are mounted in and `AWS_PROFILE` is passed through, so named profiles
and SSO keep working exactly as before.

`aws` and `docker build/push` stay on the host (the host needs `aws` for the SSO
browser in `dude iac login` anyway, and image builds need the host daemon).
Everything else — terraform/kubectl/helm — runs in the container. Set
`DUDE_IAC_RUNNER=host` to use native tools instead; `dude iac` also falls back to
native automatically when Docker isn't running.

New command **`dude iac shell --env <env>`** opens an interactive shell in the
runner with the full toolchain + k9s, the env's AWS profile and the cluster
kubeconfig already wired — for ad-hoc inspection or changes.
