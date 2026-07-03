---
'@cubocicloide/stack-react-django': minor
'@cubocicloide/dude': patch
---

feat: new `react-django` stack — React (Vite + TS) frontend with a Django 5 + DRF backend.

- Backend template: custom User model, split settings (base/local/production via
  django-environ), services layer for writes, drf-spectacular (`/api/schema/`,
  Swagger UI at `/api/docs/`), pytest + pytest-django, uv-managed.
- Init questions mirror react-fastapi plus a new `storage` select (`none` | `s3`);
  choosing `s3` adds a `files` Django app (uploads via django-storages/boto3,
  presigned URLs) and a MinIO service (+ bucket bootstrap) in docker-compose.
- 14 Django lint checks (BE001–BE014, 9 errors / 5 warnings) enforcing app
  registration parity, explicit serializer fields/permissions, no raw SQL, no ORM
  writes in views, committed migrations, settings hygiene, URL namespacing,
  model quality, related_name, logging over print, typed OpenAPI schema and
  per-app tests — each with a matching `.claude/rules/BE/*.md`.
- Full command set: up/down/logs/shell, lint, format, review, test, docs,
  security (bandit/semgrep(+p/django)/trivy), api sync/review (drf-spectacular),
  db makemigration/migrate/rollback/superuser.
- IaC target `--iac aws-ecs`: Terraform for ECS Fargate — ALB path routing
  (backend/frontend), two ECR repos, RDS PostgreSQL with Secrets Manager
  credentials, optional S3 media bucket / ElastiCache Redis / Celery worker+beat
  services, one-off migration task driven by the new `dude iac migrate` command.
- CLI: register the `react-django` stack in `registry.json`.
