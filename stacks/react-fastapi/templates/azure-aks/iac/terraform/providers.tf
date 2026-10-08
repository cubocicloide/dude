provider "azurerm" {
  features {
    resource_group {
      # `dude iac destroy` tears an environment down as a whole, and AKS adds
      # resources to the group that Terraform does not track. Without this, the
      # destroy fails on "resource group is not empty" for resources Terraform
      # itself cannot name.
      prevent_deletion_if_contains_resources = false
    }
  }

  # Empty = fall back to ARM_SUBSCRIPTION_ID, which `dude iac` exports from the
  # environment's resolved subscription. Set `subscription_id` in the env's
  # terraform.tfvars to pin it instead.
  subscription_id = var.subscription_id != "" ? var.subscription_id : null
}

# Authenticate the kubernetes/helm providers against the cluster created in this
# same configuration, using the admin-free user credentials AKS returns. No
# kubeconfig file is required, so the flow is identical locally and in CI.
provider "kubernetes" {
  host                   = azurerm_kubernetes_cluster.this.kube_config.0.host
  client_certificate     = base64decode(azurerm_kubernetes_cluster.this.kube_config.0.client_certificate)
  client_key             = base64decode(azurerm_kubernetes_cluster.this.kube_config.0.client_key)
  cluster_ca_certificate = base64decode(azurerm_kubernetes_cluster.this.kube_config.0.cluster_ca_certificate)
}

provider "helm" {
  kubernetes {
    host                   = azurerm_kubernetes_cluster.this.kube_config.0.host
    client_certificate     = base64decode(azurerm_kubernetes_cluster.this.kube_config.0.client_certificate)
    client_key             = base64decode(azurerm_kubernetes_cluster.this.kube_config.0.client_key)
    cluster_ca_certificate = base64decode(azurerm_kubernetes_cluster.this.kube_config.0.cluster_ca_certificate)
  }
}
