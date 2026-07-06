# Airflow metadata database — RDS Postgres, private (no public access),
# reachable only from the Airflow tasks' security group.

resource "aws_db_subnet_group" "this" {
  name       = local.name
  subnet_ids = aws_subnet.public[*].id
}

resource "aws_security_group" "rds" {
  name_prefix = "${local.name}-rds-"
  description = "Metadata DB - only reachable from the Airflow tasks"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "Postgres from Airflow tasks"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.service.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "random_password" "db" {
  length  = 32
  special = false # keeps the connection URI free of escaping issues
}

resource "aws_db_instance" "this" {
  identifier     = local.name
  engine         = "postgres"
  engine_version = var.db_engine_version

  instance_class    = var.db_instance_class
  allocated_storage = var.db_allocated_storage
  storage_type      = "gp3"

  db_name  = "airflow"
  username = "airflow"
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  multi_az               = var.db_multi_az

  backup_retention_period = var.db_backup_retention_days
  storage_encrypted       = true

  # Dev-friendly teardown; flip both for production environments.
  skip_final_snapshot = var.db_skip_final_snapshot
  deletion_protection = var.db_deletion_protection

  apply_immediately = true
}
