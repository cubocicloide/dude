---
"@cubocicloide/stack-react-fastapi": patch
---

Default the aws-eks RDS instance to gp3 storage. The Terraform RDS module did
not set `storage_type`, so AWS fell back to gp2 and `dude iac apply` could fail
with `InsufficientDBInstanceCapacity: ... no Availability Zones with sufficient
capacity ... storage type : gp2 for db.t4g.micro`. Add a `db_storage_type`
variable (default `gp3`), pass it to the module, and set it in the dev tfvars —
gp3 is the current-generation general-purpose SSD, cheaper than gp2 and with far
better small-instance capacity availability. This brings react-fastapi in line
with the react-django, frappe and airflow stacks, which already pin gp3.
