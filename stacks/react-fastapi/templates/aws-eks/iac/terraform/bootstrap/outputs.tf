output "state_bucket" {
  description = "Set this as `bucket` in every environment's backend.hcl."
  value       = aws_s3_bucket.state.id
}

output "lock_table" {
  description = "Set this as `dynamodb_table` in every environment's backend.hcl."
  value       = aws_dynamodb_table.lock.name
}

output "ecr_backend_repository_url" {
  description = "Shared ECR repository URL for the backend image."
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_frontend_repository_url" {
  description = "Shared ECR repository URL for the frontend image."
  value       = aws_ecr_repository.frontend.repository_url
}
