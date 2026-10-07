---
"@cubocicloide/stack-react-fastapi": patch
"@cubocicloide/stack-react-django": patch
"@cubocicloide/stack-fastmcp": patch
"@cubocicloide/stack-frappe": patch
"@cubocicloide/stack-airflow": patch
---

Make the IaC runner image build resilient to transient DNS/connection failures.
The runner Dockerfiles download terraform/kubectl/helm/k9s/aws with `curl --retry
--retry-connrefused`, but those flags do not retry DNS-resolution failures (curl
exit 6) — so a transient Docker Desktop / host resolver hiccup on a CDN-fronted
host (e.g. `releases.hashicorp.com`, `get.helm.sh`) aborted `dude iac bootstrap`
on first use. Add `--retry-all-errors` so resolution and connection flakes are
retried like any other transient error.
