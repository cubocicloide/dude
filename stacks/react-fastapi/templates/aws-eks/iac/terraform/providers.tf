provider "aws" {
  region = var.region

  # Pin to the standard public endpoints — the AWS provider 5.x enables
  # endpoint discovery by default for DynamoDB, which can return a
  # VPC-endpoint-scoped URL that doesn't resolve from a local machine.
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

# Authenticate the kubernetes/helm providers against the cluster created in this
# same configuration, using a short-lived token from the AWS CLI (exec plugin).
# No kubeconfig file is required, so the flow is identical locally and in CI.
provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name, "--region", var.region]
  }
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

    exec {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name, "--region", var.region]
    }
  }
}
