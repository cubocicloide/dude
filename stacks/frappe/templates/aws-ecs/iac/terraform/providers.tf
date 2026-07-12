provider "aws" {
  region = var.region

  # Pin to the standard public endpoints — the AWS provider 5.x enables
  # endpoint discovery by default and can return VPC-endpoint-scoped URLs
  # that don't resolve from a local machine.
  endpoints {
    dynamodb = "https://dynamodb.${var.region}.amazonaws.com"
    s3       = "https://s3.${var.region}.amazonaws.com"
  }

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
