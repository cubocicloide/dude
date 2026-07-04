# ECS Fargate deployment for Airflow: the api-server (web UI + API) behind an
# internet-facing ALB, a "core" service running scheduler + dag-processor +
# triggerer, RDS Postgres as the metadata DB, and the AWS ECS executor so
# every Airflow task runs in its own dedicated Fargate container.
#
# Why ECS (and not EKS/MWAA): the scaffold targets small-to-mid deployments —
# a Kubernetes control plane costs more per month than this whole stack, and
# unlike MWAA you keep full control of the image, providers and executor.
# Networking/ALB mirror the other dude stacks: public subnets, no NAT
# (~$65/month saved per env), tasks admit traffic only from the ALB or peers.

locals {
  name           = "${var.project_name}-${var.environment}"
  container_port = 8080
  with_domain    = var.domain_name != "" && var.route53_zone_name != ""

  # Private DNS namespace: core components reach the api-server's execution
  # API at http://web.<project>-<env>.local:8080 without leaving the VPC.
  dns_namespace = "${local.name}.local"
  airflow_url   = local.with_domain ? "https://${var.domain_name}" : "http://${aws_lb.this.dns_name}"
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# ── Network ──────────────────────────────────────────────────────────────────

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
  description = "ALB - admits HTTP/HTTPS from allowed_cidrs"
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
  description = "Airflow tasks - reachable from the ALB and from each other"
  vpc_id      = aws_vpc.this.id

  ingress {
    description     = "Airflow API from the ALB"
    from_port       = local.container_port
    to_port         = local.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Scheduler / executor workers call the api-server's execution API directly
  # (via the private DNS namespace), so peers must reach each other on 8080.
  ingress {
    description = "Execution API between Airflow components"
    from_port   = local.container_port
    to_port     = local.container_port
    protocol    = "tcp"
    self        = true
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

# ── Service discovery (Cloud Map) ────────────────────────────────────────────
# A private A record per api-server task: web.<project>-<env>.local.

resource "aws_service_discovery_private_dns_namespace" "this" {
  name = local.dns_namespace
  vpc  = aws_vpc.this.id
}

resource "aws_service_discovery_service" "web" {
  name = "web"

  dns_config {
    namespace_id   = aws_service_discovery_private_dns_namespace.this.id
    routing_policy = "MULTIVALUE"

    dns_records {
      type = "A"
      ttl  = 10
    }
  }
}

# ── Load balancer ────────────────────────────────────────────────────────────

resource "aws_lb" "this" {
  name               = local.name
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  idle_timeout = var.alb_idle_timeout
}

resource "aws_lb_target_group" "web" {
  name        = local.name
  port        = local.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.this.id

  # Airflow's unauthenticated liveness endpoint.
  health_check {
    path                = "/api/v2/monitor/health"
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
    target_group_arn = aws_lb_target_group.web.arn
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
    target_group_arn = aws_lb_target_group.web.arn
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
