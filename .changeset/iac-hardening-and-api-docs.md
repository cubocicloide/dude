---
"@cubocicloide/dude": minor
"@cubocicloide/stack-react-fastapi": minor
---

Harden the AWS EKS IaC target end-to-end and add a live, auto-generated command reference.

**@cubocicloide/dude**
- `dude help --format md` / `--format json` (also `--md` / `--json`) emit the full,
  init-aware command catalog (core + active stack + project-local `.dude/commands/`)
  as Markdown or JSON — useful for docs and LLM/tooling consumption.
- New public API `generateApiDoc(cwd, format)` so stacks can render that catalog
  (e.g. to regenerate a docs page) without shelling out.

**@cubocicloide/stack-react-fastapi**
- `dude docs` now regenerates `docs/api.md` from the live command catalog before
  serving, so the documented API always matches the project's actual commands
  (gitignored; also printable via `dude help --format md`).
- IaC: ECR repositories are now **shared across environments** and owned by the
  `bootstrap` config (one image, promoted by tag), instead of being recreated per
  env — this avoids `RepositoryAlreadyExistsException` and stops one env's destroy
  from deleting another's registry. Repo URLs are derived from the account id
  (`aws_caller_identity`), so plan/apply/destroy no longer depend on the ECR API.
- IaC: `dude iac destroy` now removes the Route53 records external-dns created for
  the env, guards the shared backend (S3 + DynamoDB + ECR) so it is torn down only
  with the **last** environment, and auto-retries after clearing leftover
  Kubernetes networking (load-balancer security groups and dangling CNI ENIs) that
  otherwise block VPC/subnet deletion with `DependencyViolation`.
- IaC: `dude iac init` now passes `-reconfigure`, so switching `--env` against the
  shared Terraform working directory no longer fails with "Backend configuration
  changed".
- IaC fixes: pin the RDS endpoint alongside DynamoDB/S3 (avoids a local DNS lookup
  failure during bootstrap/apply); `db_engine_version` defaults to `"17"`.
- Docs: the generated project's docs now include a conditional IaC command section,
  a new "Command reference" page, and an expanded deploy guide (adding environments,
  multi-env teardown).
