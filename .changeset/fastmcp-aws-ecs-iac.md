---
'@cubocicloide/stack-fastmcp': minor
---

Add AWS deployment support to the fastmcp stack (`--iac aws-ecs`): the init flow
now asks for an IaC target (none / aws-ecs). Choosing `aws-ecs` scaffolds
Terraform for a single ECS Fargate service behind an ALB (SSE-friendly idle
timeout, `/health` target-group probe, optional ACM + Route53 HTTPS), a shared
bootstrap (S3 state + DynamoDB lock + ECR repository), a production Dockerfile,
an IaC runner image and a deploy docs page — plus the full `dude iac` command
group (login, new-env, bootstrap, init, plan, apply, build, push, deploy, ship,
status, logs, output, fmt, validate, shell, destroy). The base template gains a
plain-HTTP `/health` route on the server for load-balancer health checks.
