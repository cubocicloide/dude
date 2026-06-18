---
"@cubocicloide/dude": minor
"@cubocicloide/stack-react-fastapi": minor
---

Add an AWS EKS Infrastructure-as-Code target (Terraform + Helm) and conditional command visibility.

**@cubocicloide/dude**
- `StackCommandDef` gains an optional `available(projectRoot)` predicate. When it
  returns `false`, `dude help` hides that command (and empty groups are dropped).
  This lets a stack expose feature-gated commands that only appear when the
  matching init answer was chosen.
- `dude help` now also hides the PostgreSQL-only `db` group on projects scaffolded
  without a database.

**@cubocicloide/stack-react-fastapi**
- New `iac` init option (`none` | `aws-eks`). Choosing `aws-eks` scaffolds an
  `iac/` directory with Terraform (VPC, EKS, ECR, AWS Load Balancer Controller,
  and managed RDS PostgreSQL when `--database postgres`) and a Helm chart for the
  application (backend, frontend, in-cluster Redis + Celery worker/beat/Flower
  when enabled, ALB Ingress, migration hook). The generated assets reflect the
  other answers (`postgres`/`celery`/`celerybeat`).
- Terraform uses an S3 + DynamoDB remote backend configured per-environment, so
  the same flow works locally and in CI/CD. Environments scale by copying a
  folder (`environments/dev` ships by default); a `bootstrap/` config creates the
  state bucket + lock table once.
- New `dude iac` command group — `init`, `plan`, `apply`, `destroy`, `output`,
  `fmt`, `validate`, `kubeconfig`, `deploy`, `status` — all `--env`-scoped. The
  group is shown **only** in IaC-enabled projects.
- Production Dockerfiles (`backend/Dockerfile.prod`, `frontend/Dockerfile.prod`
  + `nginx.conf`) are added for building the images deployed to EKS.
