---
"@cubocicloide/stack-react-fastapi": patch
---

fix(iac): `dude iac new-env` now also copies the per-env Helm values file

`new-env` only copied the Terraform environment folder
(`iac/terraform/environments/<name>`), leaving the new env without a
`helm/app/values-<env>.yaml`. Since that file is gitignored and optional at
deploy time, the new environment would silently deploy with the bare
`values.yaml` defaults instead of the source env's overrides (replicas,
autoscaling, config, secrets) — a quiet footgun, despite the command's "copy an
existing one" contract.

`new-env` now copies `values-<from>.yaml` → `values-<env>.yaml` when the source
file exists on disk, and the success message + docs reflect it. No change when
the source env has no values file (deploy still falls back to `values.yaml`).
