output "region" {
  description = "AWS region this environment runs in."
  value       = var.region
}

output "ecr_repository_url" {
  description = "Shared ECR repository the server image is pushed to."
  value       = data.aws_ecr_repository.server.repository_url
}

output "cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.this.name
}

output "service_name" {
  description = "ECS service name."
  value       = aws_ecs_service.app.name
}

output "log_group" {
  description = "CloudWatch log group the service logs to."
  value       = aws_cloudwatch_log_group.app.name
}

output "alb_dns_name" {
  description = "DNS name of the load balancer."
  value       = aws_lb.this.dns_name
}

output "app_domain" {
  description = "Custom domain the server is served on (empty when none is configured)."
  value       = local.with_domain ? var.domain_name : ""
}

output "mcp_url" {
  description = "The MCP endpoint clients connect to (streamable HTTP)."
  value       = local.with_domain ? "https://${var.domain_name}/mcp/" : "http://${aws_lb.this.dns_name}/mcp/"
}
