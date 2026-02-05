# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A Pulumi (TypeScript) infrastructure repository that deploys a containerized application ("sprinklerBlowouts") to AWS ECS/Fargate. There is no application source code here — the `src/` directory is empty and the `Dockerfile` is a placeholder. Application code lives elsewhere and gets built into a Docker image that this infrastructure deploys.

This repo references shared AWS resources (VPC, ALB, ECS cluster, RDS, IAM roles, CloudWatch) from a platform stack via `pulumi.StackReference`.

## Commands

```bash
npm install           # Install dependencies
npm run build         # Compile TypeScript (tsc)
npm run preview       # Preview infrastructure changes (pulumi preview)
npm run up            # Deploy infrastructure (pulumi up)
npm run destroy       # Tear down infrastructure (pulumi destroy)
```

There are no test, lint, or dev server commands configured.

## Architecture

All infrastructure is defined in a single file: `index.ts`. It creates:

1. **ECR Repository** — `portfolio/{appName}`, with lifecycle policy keeping last 10 images
2. **Security Group** — allows ingress on `containerPort` (default 3000) from the ALB only
3. **ALB Target Group** — HTTP health check on `/health`
4. **ALB Listener Rule** — host-based HTTPS routing (`{subdomain}.{domainName}`), priority derived from a hash of the subdomain
5. **ECS Task Definition** — Fargate, with optional RDS database env vars (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`) and secret (`DB_PASSWORD` from Secrets Manager)
6. **ECS Service** — FARGATE_SPOT by default with FARGATE fallback, 50%/200% deployment bounds
7. **Scheduled Scaling** (optional) — scales to 0 at night, back up in the morning

### Key requirement for deployed applications

The container **must** expose a `GET /health` endpoint returning HTTP 200. Both the ALB target group and the ECS task health check depend on it.

## Configuration

Stack config lives in `pulumi.dev.yaml`. Key settings:

| Config Key | Required | Default | Description |
|---|---|---|---|
| `appName` | yes | — | Application name (used for resource naming) |
| `subdomain` | yes | — | Subdomain for ALB host-based routing |
| `platformStack` | yes | — | Pulumi stack reference to shared platform |
| `cpu` | no | `256` | Fargate CPU units |
| `memory` | no | `512` | Fargate memory (MB) |
| `desiredCount` | no | `1` | Number of tasks |
| `containerPort` | no | `3000` | Container port |
| `useFargateSpot` | no | `true` | Use FARGATE_SPOT capacity provider |
| `enableScheduledScaling` | no | `false` | Enable time-based scaling |
| `scaleUpHour` / `scaleDownHour` | no | `6` / `22` | Hours for scheduled scaling |
| `scheduleTimezone` | no | `America/Denver` | Timezone for scheduled scaling |

## CI/CD

GitHub Actions workflow (`.github/workflows/deploy.yml`) triggers on push to `main` or manual dispatch. It builds the Docker image, pushes to ECR (tagged with commit SHA + `latest`), runs `pulumi up`, and forces an ECS service update.

Required GitHub secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `PULUMI_ACCESS_TOKEN`.

## Stack Outputs

- `appUrl` — HTTPS URL (`https://{subdomain}.{domainName}`)
- `albUrl` — Direct ALB URL
- `ecrRepositoryUrl` — ECR repository URL for Docker pushes
- `serviceName` / `serviceArn` — ECS service identifiers
