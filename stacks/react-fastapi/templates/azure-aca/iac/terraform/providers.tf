provider "azurerm" {
  features {
    resource_group {
      # `dude iac destroy` tears an environment down as a whole, and the Container
      # Apps platform adds resources to the group that Terraform does not track.
      # Without this, the destroy fails on "resource group is not empty" for
      # resources Terraform itself cannot name.
      prevent_deletion_if_contains_resources = false
    }
  }

  # Empty = fall back to ARM_SUBSCRIPTION_ID, which `dude iac` exports from the
  # environment's resolved subscription. Set `subscription_id` in the env's
  # terraform.tfvars to pin it instead.
  subscription_id = var.subscription_id != "" ? var.subscription_id : null
}
