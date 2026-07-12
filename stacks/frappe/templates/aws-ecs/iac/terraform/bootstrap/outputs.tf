output "state_bucket" {
  description = "Set this as `bucket` in every environment's backend.hcl."
  value       = aws_s3_bucket.state.id
}

output "lock_table" {
  description = "Set this as `dynamodb_table` in every environment's backend.hcl."
  value       = aws_dynamodb_table.lock.name
}

output "ecr_app_repository_url" {
  description = "Shared ECR repository URL for the production Frappe image."
  value       = aws_ecr_repository.app.repository_url
}
