---
'@cubocicloide/stack-react-fastapi': minor
'@cubocicloide/dude': minor
---

react-fastapi: add an `azure-aks` IaC target alongside `aws-eks`

`dude init --stack react-fastapi --iac azure-aks` now scaffolds a complete Azure
deployment: Terraform for a resource group, VNet, AKS cluster, Azure Container
Registry and (with `--database postgres`) a private PostgreSQL Flexible Server,
plus a Helm chart released through the same `dude iac` commands as the AWS
target. Remote state lives in an Azure Storage blob container, whose lease is
also the state lock — there is no lock-table equivalent to create.

The application is published on Azure's own `*.cloudapp.azure.com` hostname, so
no domain registration or DNS delegation is involved. That hostname is HTTP-only
by design: `cloudapp.azure.com` is not on the Public Suffix List, so Let's
Encrypt attributes any certificate for it to `azure.com` and refuses under a
rate limit shared by every Azure customer. `iac/README.md` says so plainly and
documents the cert-manager path for a domain you do own.

Both targets scaffold into `iac/`, so a provider is now selected by the recorded
`iac` scaffold answer rather than by the presence of that directory. Projects
scaffolded before this change keep resolving to `aws-eks`.

On the CLI side, a stack's `docs.iac` manifest field accepts a list of targets as
well as a single one; `iacTargets()` is exported to normalise the two forms.
Existing single-target manifests are unaffected, and the generated
`dude.stack/1` JSON keeps its `iac` field, gaining an additive `iacTargets`.

---

react-fastapi: add an `azure-aca` IaC target (Azure Container Apps)

`--iac azure-aca` scaffolds the same application without Kubernetes: Terraform
describes one container app per service — frontend, backend, and, following the
init answers, a Celery worker, a Celery Beat scheduler and Redis — plus a shared
registry, an optional private PostgreSQL Flexible Server and a Container Apps
job that runs `alembic upgrade head`.

Two things make it more than a third flavour of the same thing. It needs **no VM
quota**, so it deploys on restricted subscriptions where a Kubernetes cluster
cannot be created at all. And the platform serves the app over **HTTPS with a
Microsoft-managed certificate** on `*.azurecontainerapps.io`, which the AKS
target cannot do without a domain of your own.

It implements the canonical command set minus `kubeconfig` (no cluster to point
one at) and plus `logs` and `migrate`. `deploy` records the image tag in the
environment's `terraform.tfvars` and applies, so the deployed version is a
committed fact rather than imperative drift the next apply would revert.

Twelve of the commands are now shared across the Azure targets rather than
duplicated: `iac/azure/` holds the Docker runner, the registry plumbing, the
Terraform helpers and the command factories, and each provider contributes only
what depends on how it runs an application. The AKS target's behaviour is
unchanged.
