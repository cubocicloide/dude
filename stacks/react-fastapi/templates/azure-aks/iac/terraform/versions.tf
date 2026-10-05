terraform {
  required_version = ">= 1.6.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.14"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.31"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.17"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Partial backend: the concrete resource group / storage account / container are
  # supplied per environment via `-backend-config=environments/<env>/backend.hcl`
  # at `terraform init`. This keeps a single root usable both locally and from
  # CI/CD. State locking is a blob lease — no separate lock table exists or is
  # needed.
  backend "azurerm" {}
}
