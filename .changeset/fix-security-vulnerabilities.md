---
'@cubocicloide/stack-react-fastapi': minor
---

Fix the CRITICAL/HIGH findings `dude security scan` reports on a fresh scaffold.

- **RDS security group** egress is restricted to the VPC CIDR instead of
  `0.0.0.0/0` (AVD-AWS-0104).
- **ECR repositories** are now `IMMUTABLE` (AVD-AWS-0031). To keep that
  workable, the default image tag gained a digest of the uncommitted diff —
  `<sha>-dirty-<hash>` rather than a constant `-dirty` — so iterating on a
  branch produces a fresh tag each time. Re-pushing a tag that already exists
  now fails fast, before the build, with the three ways out (commit, `--tag`,
  or just `dude iac deploy` the image already in ECR).
- **Production images run unprivileged** (DS002): the backend creates `appuser`
  before building the virtualenv, so no `chown -R` layer duplicates it, and the
  frontend moves to `nginxinc/nginx-unprivileged`. That image cannot bind a
  privileged port, so nginx and the Helm `frontend.port` value both move to
  8080 — the ALB still listens on 80/443.
- **Development images stay root**, and DS002 is silenced for them through a
  new `security/.trivyignore.yaml`. They bind-mount your source tree, and a
  fixed UID breaks writes back into it (`dude db makemigration`) on any host
  whose UID is not 1000.
- **Trivy no longer reports third-party Terraform modules**
  (`--tf-exclude-downloaded-modules`, plus `.terraform` in `--skip-dirs`). Once
  `dude iac init` has run, the vendored VPC/EKS module source is what produced
  AVD-AWS-0130 and one of the two AVD-AWS-0104 hits — findings in code nobody
  using this stack can act on.
- **Terraform state is encrypted with a customer managed KMS key**
  (AVD-AWS-0132), key rotation on and a bucket key to keep KMS request costs
  flat. State holds every resource attribute, the generated RDS password
  included, so it is worth an auditable, revocable key.
- **GHSA-qwww-vcr4-c8h2** (react-router) is recorded as not applicable: it is a
  CSRF bypass in RSC mode, which a Vite SPA never enters, and the only fix is
  the 8.x major. The ignore entry expires 2027-02-01 so it comes back for
  review rather than disappearing.

A fresh `--iac aws-eks` scaffold now scans clean: `dude security scan` reports
0 CRITICAL and 0 HIGH, down from 2 and 9.

No IMDSv2 override is added to the EKS node group: the module already defaults
`http_tokens` to `required`, and since it replaces `metadata_options` wholesale
rather than merging, setting only `http_tokens` would silently drop
`http_put_response_hop_limit` from 2 to 1 and cut pods off from instance
metadata.
