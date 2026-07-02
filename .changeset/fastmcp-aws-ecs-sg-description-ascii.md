---
'@cubocicloide/stack-fastmcp': patch
---

Fix `dude iac apply` failing with `InvalidParameterValue: ... Character sets
beyond ASCII are not supported` for the `aws-ecs` IaC target. The `alb` and
`service` security group descriptions used an em-dash, which AWS's
`CreateSecurityGroup` API rejects; replaced with a plain hyphen.
