# ECS Fargate deployment for the FastMCP server: one stateless HTTP container
# behind an internet-facing ALB, with the image pulled from the shared ECR
# repository created by `dude iac bootstrap`.
#
# Why ECS (and not EKS): the scaffold is a single service with no database,
# queue, or persistent volume — a Kubernetes control plane would cost more per
# month than the workload itself. Fargate runs the container serverlessly; the
# ALB (unlike App Runner or Lambda URLs) fully supports the long-lived SSE
# streams that MCP's streamable-HTTP transport relies on.

locals {
  name           = "${var.project_name}-${var.environment}"
  container_name = "fastmcp"
  container_port = 8000
  with_domain    = var.domain_name != "" && var.route53_zone_name != ""
}

data "aws_availability_zones" "available" {
  state = "available"
}

# ── Network ──────────────────────────────────────────────────────────────────
# A minimal VPC with two public subnets. Tasks run in the public subnets with a
# public IP (for image pulls / egress) but their security group only admits
# traffic from the ALB — this avoids the ~$65/month a NAT gateway pair would
# cost a dev environment. Move the tasks to private subnets + NAT if your
# compliance posture requires it.

resource "aws_vpc" "this" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = local.name }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = { Name = local.name }
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(aws_vpc.this.cidr_block, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = { Name = "${local.name}-public-${count.index}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = { Name = "${local.name}-public" }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ── Security groups ──────────────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name_prefix = "${local.name}-alb-"
  description = "ALB — admits HTTP/HTTPS from allowed_cidrs"
  vpc_id      = aws_vpc.this.id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidrs
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidrs
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

resource "aws_security_group" "service" {
  name_prefix = "${local.name}-svc-"
  description = "FastMCP tasks — only reachable from the ALB"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "MCP over HTTP from the ALB"
    from_port       = local.container_port
    to_port         = local.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
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

# ── Registry & logs ──────────────────────────────────────────────────────────
# The ECR repository is shared across environments and owned by the bootstrap
# config (one image, promoted dev → staging → prod by tag) — read it by name.

data "aws_ecr_repository" "server" {
  name = "${var.project_name}-server"
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name}"
  retention_in_days = var.log_retention_days
}

# ── IAM ──────────────────────────────────────────────────────────────────────

data "aws_iam_policy_document" "task_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${local.name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.task_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task" {
  name               = "${local.name}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.task_assume.json
}

# ECS Exec — lets `aws ecs execute-command` open a shell in a running task.
resource "aws_iam_role_policy" "task_ecs_exec" {
  name = "ecs-exec"
  role = aws_iam_role.task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ssmmessages:CreateControlChannel",
        "ssmmessages:CreateDataChannel",
        "ssmmessages:OpenControlChannel",
        "ssmmessages:OpenDataChannel",
      ]
      Resource = "*"
    }]
  })
}

# ── Load balancer ────────────────────────────────────────────────────────────

resource "aws_lb" "this" {
  name               = local.name
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  # MCP streamable HTTP holds long-lived SSE streams — see var.alb_idle_timeout.
  idle_timeout = var.alb_idle_timeout
}

resource "aws_lb_target_group" "app" {
  name        = local.name
  port        = local.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.this.id

  # `/health` is a plain-HTTP liveness route the scaffold serves alongside the
  # MCP endpoint (the MCP endpoint itself rejects probe requests without the
  # proper Accept headers, so it can't be the health check target).
  health_check {
    path                = "/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30
}

# Plain HTTP when no domain is configured…
resource "aws_lb_listener" "http" {
  count             = local.with_domain ? 0 : 1
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# …or HTTPS with an ACM certificate + HTTP→HTTPS redirect when one is.
data "aws_route53_zone" "this" {
  count = local.with_domain ? 1 : 0
  name  = var.route53_zone_name
}

resource "aws_acm_certificate" "this" {
  count             = local.with_domain ? 1 : 0
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = local.with_domain ? {
    for dvo in aws_acm_certificate.this[0].domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  } : {}

  zone_id         = data.aws_route53_zone.this[0].zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 60
  records         = [each.value.record]
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "this" {
  count                   = local.with_domain ? 1 : 0
  certificate_arn         = aws_acm_certificate.this[0].arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
}

resource "aws_lb_listener" "https" {
  count             = local.with_domain ? 1 : 0
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.this[0].certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

resource "aws_lb_listener" "http_redirect" {
  count             = local.with_domain ? 1 : 0
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_route53_record" "app" {
  count   = local.with_domain ? 1 : 0
  zone_id = data.aws_route53_zone.this[0].zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}

# ── ECS (Fargate) ────────────────────────────────────────────────────────────

resource "aws_ecs_cluster" "this" {
  name = local.name
}

resource "aws_ecs_task_definition" "app" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name      = local.container_name
      image     = "${data.aws_ecr_repository.server.repository_url}:${var.image_tag}"
      essential = true

      portMappings = [
        { containerPort = local.container_port, protocol = "tcp" }
      ]

      environment = [
        { name = "MCP_TRANSPORT", value = "http" },
        { name = "MCP_HOST", value = "0.0.0.0" },
        { name = "MCP_PORT", value = tostring(local.container_port) },
        { name = "MCP_SERVER_NAME", value = var.project_name },
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.app.name
          awslogs-region        = var.region
          awslogs-stream-prefix = "fastmcp"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "app" {
  name            = local.name
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  # Shell into a running task: aws ecs execute-command --command /bin/bash …
  enable_execute_command = true

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.service.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = local.container_name
    container_port   = local.container_port
  }

  health_check_grace_period_seconds = 60

  # Roll back automatically when a deployment's tasks keep failing to start.
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener.http, aws_lb_listener.https]
}
