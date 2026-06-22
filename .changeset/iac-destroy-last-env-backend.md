---
"@cubocicloide/stack-react-fastapi": patch
---

fix(iac): destroy the shared backend + ECR when the last env is torn down

`dude iac destroy` decided whether to tear down the shared bootstrap (S3 state
bucket + DynamoDB lock + ECR repos) by listing the environment *folders* on
disk. But a folder (`backend.hcl` + `terraform.tfvars`) survives a
`terraform destroy`, so after destroying `staging` then `dev`, the guard still
saw the leftover `staging/` folder and concluded the backend was "still in use"
— refusing to ever tear it down. The shared S3 bucket, DynamoDB table and ECR
repositories were orphaned even though no live infrastructure remained.

Liveness is now read from each sibling environment's **remote Terraform state**
(empty `resources` after a destroy) instead of the on-disk folder, so the last
environment's teardown correctly removes the shared backend + ECR. The decision
is logged per sibling, and an unreadable-but-present state is treated as live so
a transient read error never wipes another env's backend.
