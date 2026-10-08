output "resource_group_name" {
  description = "Set this as `resource_group_name` in every environment's backend.hcl."
  value       = azurerm_resource_group.shared.name
}

output "storage_account_name" {
  description = "Set this as `storage_account_name` in every environment's backend.hcl."
  value       = azurerm_storage_account.state.name
}

output "container_name" {
  description = "Set this as `container_name` in every environment's backend.hcl."
  value       = azurerm_storage_container.state.name
}

output "acr_name" {
  description = "Shared container registry name — set as `acr_name` in each environment's terraform.tfvars."
  value       = azurerm_container_registry.shared.name
}

output "acr_login_server" {
  description = "Shared container registry login server (the image registry host)."
  value       = azurerm_container_registry.shared.login_server
}
