Staging Deployment Notes

Goal
Prepare a minimal, repeatable staging environment that runs the frontend, a backend API, Postgres+PostGIS, Redis, and RabbitMQ for async tasks.

Checklist
- [ ] Create staging cloud project (AWS/GCP) and obtain credentials
- [ ] Create secrets store (Vault or cloud secret manager)
- [ ] Build and publish Docker images for API and worker
- [ ] Provision Postgres with PostGIS and run `sql/schema_core.sql`
- [ ] Configure environment variables and credentials for external integrations (sandbox keys)
- [ ] Configure monitoring (Prometheus + Grafana) and error tracking
- [ ] Run smoke tests: register user, create farm, Jicho scan, create listing

Docker (local staging)
Files added:
- `infra/docker-compose.yml` — compose stack for local staging
- `api/Dockerfile` — simple Node Dockerfile for mock API

Run locally:
```bash
docker-compose -f infra/docker-compose.yml up --build
```

Dockerfile (API)
See `api/Dockerfile` for a minimal example that runs `api/mock_server.js`.

Terraform example (AWS ECS - minimal)
```hcl
# provider "aws" { region = "us-east-1" }
# Create ECR repo, build/push image, then create ECS cluster + service using that image.
```

Notes
- For initial staging, a single t3.small EC2 (or equivalent) with Docker Compose is simplest.
- Use RDS Postgres with the PostGIS extension enabled for production-like testing.
- For Railway, create a separate staging project/service and isolated staging database; never point staging at the production database.
- For Google OAuth, use staging-only callback and frontend URLs and configure credentials directly in the staging secret manager. Follow [authentication setup](./authentication.md) before testing sign-in and administrator permissions.
- Keep production unchanged until staging authentication, account migration, authorization, moderation, and integration checks pass and production rollout is explicitly approved.
