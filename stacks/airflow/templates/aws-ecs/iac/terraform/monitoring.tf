# Monitoring — one CloudWatch dashboard per environment (always), plus email
# alarms when `alarm_email` is set in terraform.tfvars.
#
#   dude iac output --env <env>    → dashboard_url
#   dude iac status --env <env>    → services + health + recent worker stops
#   dude iac logs   --env <env>    → live logs (--service scheduler, --follow)

locals {
  alb_dim = aws_lb.this.arn_suffix
  tg_dim  = aws_lb_target_group.web.arn_suffix

  dashboard_name = local.name
  dashboard_url  = "https://${var.region}.console.aws.amazon.com/cloudwatch/home?region=${var.region}#dashboards/dashboard/${local.dashboard_name}"
}

resource "aws_cloudwatch_dashboard" "this" {
  dashboard_name = local.dashboard_name

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric", x = 0, y = 0, width = 12, height = 6,
        properties = {
          title  = "ECS CPU (%)"
          region = var.region
          stat   = "Average"
          period = 60
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ClusterName", aws_ecs_cluster.this.name, "ServiceName", aws_ecs_service.web.name, { label = "web" }],
            ["AWS/ECS", "CPUUtilization", "ClusterName", aws_ecs_cluster.this.name, "ServiceName", aws_ecs_service.core.name, { label = "core (scheduler + LocalExecutor tasks)" }],
          ]
        }
      },
      {
        type = "metric", x = 12, y = 0, width = 12, height = 6,
        properties = {
          title  = "ECS memory (%)"
          region = var.region
          stat   = "Average"
          period = 60
          metrics = [
            ["AWS/ECS", "MemoryUtilization", "ClusterName", aws_ecs_cluster.this.name, "ServiceName", aws_ecs_service.web.name, { label = "web" }],
            ["AWS/ECS", "MemoryUtilization", "ClusterName", aws_ecs_cluster.this.name, "ServiceName", aws_ecs_service.core.name, { label = "core" }],
          ]
        }
      },
      {
        type = "metric", x = 0, y = 6, width = 12, height = 6,
        properties = {
          title  = "ALB — requests & healthy hosts"
          region = var.region
          period = 60
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", local.alb_dim, { stat = "Sum", label = "requests" }],
            ["AWS/ApplicationELB", "HealthyHostCount", "TargetGroup", local.tg_dim, "LoadBalancer", local.alb_dim, { stat = "Minimum", label = "healthy web tasks" }],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", local.alb_dim, { stat = "Sum", label = "5xx" }],
          ]
        }
      },
      {
        type = "metric", x = 12, y = 6, width = 12, height = 6,
        properties = {
          title  = "Metadata DB (RDS)"
          region = var.region
          stat   = "Average"
          period = 60
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.this.identifier, { label = "cpu %" }],
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", aws_db_instance.this.identifier, { label = "connections", yAxis = "right" }],
          ]
        }
      },
      {
        type = "log", x = 0, y = 12, width = 24, height = 8,
        properties = {
          title  = "Recent errors (all components)"
          region = var.region
          query  = "SOURCE '${aws_cloudwatch_log_group.app.name}' | fields @timestamp, @logStream, @message | filter @message like /(?i)(error|exception|traceback)/ | sort @timestamp desc | limit 100"
          view   = "table"
        }
      },
    ]
  })
}

# ── Alarms (only when alarm_email is set) ────────────────────────────────────

resource "aws_sns_topic" "alarms" {
  count = var.alarm_email != "" ? 1 : 0
  name  = "${local.name}-alarms"
}

resource "aws_sns_topic_subscription" "alarms_email" {
  count     = var.alarm_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alarms[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# The web UI has no healthy task behind the ALB — the deployment is down.
resource "aws_cloudwatch_metric_alarm" "web_unhealthy" {
  count               = var.alarm_email != "" ? 1 : 0
  alarm_name          = "${local.name}-web-no-healthy-tasks"
  alarm_description   = "No healthy Airflow api-server task behind the ALB."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HealthyHostCount"
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 1
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"

  dimensions = {
    TargetGroup  = local.tg_dim
    LoadBalancer = local.alb_dim
  }

  alarm_actions = [aws_sns_topic.alarms[0].arn]
  ok_actions    = [aws_sns_topic.alarms[0].arn]
}

# The core task (scheduler + LocalExecutor tasks) is CPU-saturated — DAGs will
# lag. Scale core_cpu, or move heavy tasks to the dedicated executor.
resource "aws_cloudwatch_metric_alarm" "core_cpu" {
  count               = var.alarm_email != "" ? 1 : 0
  alarm_name          = "${local.name}-core-cpu-high"
  alarm_description   = "Airflow core service CPU > 85% for 10 minutes."
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"

  dimensions = {
    ClusterName = aws_ecs_cluster.this.name
    ServiceName = aws_ecs_service.core.name
  }

  alarm_actions = [aws_sns_topic.alarms[0].arn]
  ok_actions    = [aws_sns_topic.alarms[0].arn]
}

# The metadata DB is running out of disk.
resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  count               = var.alarm_email != "" ? 1 : 0
  alarm_name          = "${local.name}-rds-storage-low"
  alarm_description   = "Metadata DB has less than 2 GiB of free storage."
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Minimum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 2147483648 # 2 GiB in bytes
  comparison_operator = "LessThanThreshold"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.this.identifier
  }

  alarm_actions = [aws_sns_topic.alarms[0].arn]
  ok_actions    = [aws_sns_topic.alarms[0].arn]
}
