output "region" {
  description = "AWS region this environment runs in."
  value       = var.region
}

output "ecr_repository_url" {
  description = "Shared ECR repository the Airflow image is pushed to."
  value       = data.aws_ecr_repository.airflow.repository_url
}

output "cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.this.name
}

output "service_name" {
  description = "The web (api-server) ECS service — the one behind the ALB."
  value       = aws_ecs_service.web.name
}

output "service_names" {
  description = "Every long-running ECS service in this environment."
  value       = [aws_ecs_service.web.name, aws_ecs_service.core.name]
}

output "worker_task_definition" {
  description = "Task-definition family the ECS executor launches per Airflow task."
  value       = aws_ecs_task_definition.worker.family
}

output "migrate_task_definition" {
  description = "One-off task definition used by `dude iac migrate`."
  value       = aws_ecs_task_definition.migrate.family
}

output "public_subnet_ids" {
  description = "Subnets one-off tasks run in."
  value       = aws_subnet.public[*].id
}

output "service_security_group_id" {
  description = "Security group of the Airflow tasks."
  value       = aws_security_group.service.id
}

output "app_secrets_arn" {
  description = "Secrets Manager secret holding the app's KEY=VALUE secrets (dude iac secrets)."
  value       = aws_secretsmanager_secret.app.arn
}

output "logs_bucket" {
  description = "S3 bucket task logs are written to (remote logging)."
  value       = aws_s3_bucket.logs.bucket
}

output "log_group" {
  description = "CloudWatch log group the containers log to."
  value       = aws_cloudwatch_log_group.app.name
}

output "alb_dns_name" {
  description = "DNS name of the load balancer."
  value       = aws_lb.this.dns_name
}

output "app_domain" {
  description = "Custom domain the UI is served on (empty when none is configured)."
  value       = local.with_domain ? var.domain_name : ""
}

output "airflow_url" {
  description = "The Airflow web UI / API endpoint."
  value       = local.airflow_url
}

output "dashboard_url" {
  description = "CloudWatch dashboard for this environment (ECS, ALB, RDS, recent errors)."
  value       = local.dashboard_url
}

output "db_endpoint" {
  description = "RDS endpoint of the metadata database."
  value       = aws_db_instance.this.address
}
