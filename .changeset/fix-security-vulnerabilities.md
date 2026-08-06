---
"@cubocicloide/stack-react-fastapi": patch
---

Fix critical and high security vulnerabilities in react-fastapi stack templates:
- Restrict RDS security group egress to VPC only (was allowing all traffic to 0.0.0.0/0)
- Enable IMDSv2 for EKS managed node group instances
- Set ECR repositories to use immutable image tags
- Run Docker containers as non-root user (appuser) for enhanced security
