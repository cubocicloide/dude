---
'@cubocicloide/stack-frappe': patch
---

Fix `terraform apply` failure on the ECS IaC: the `aws_security_group.app` self-ingress rule description used a `->` arrow, and AWS rejects `>` in security group rule descriptions (`"ingress.0.description" doesn't comply with restrictions`). Reworded to "frontend to backend/websocket (service discovery)".
