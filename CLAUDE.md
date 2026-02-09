# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A combined infrastructure + application repository for the Sprinkler Blowouts service. It contains:

- **`src/`** — A full Next.js application (pages, API routes, components, libs) for scheduling sprinkler blowout appointments.
- **`index.ts`** — Pulumi (TypeScript) infrastructure that deploys the containerized app to AWS ECS/Fargate.
- **`Dockerfile`** — Multi-stage build that produces a Next.js standalone production image.

This repo references shared AWS resources (VPC, ALB, ECS cluster, IAM roles, CloudWatch) from a platform stack via `pulumi.StackReference`.

## Commands

```bash
npm install           # Install dependencies (infrastructure)
npm run build         # Compile TypeScript (tsc)
npm run preview       # Preview infrastructure changes (pulumi preview)
npm run up            # Deploy infrastructure (pulumi up)
npm run destroy       # Tear down infrastructure (pulumi destroy)
npm run seed:zone     # Seed service zone data into MongoDB (npx tsx scripts/seed-zone.ts)
```

Utility scripts in `scripts/`:
- `scripts/seed-zone.ts` — Seeds the service zone (Tri-Cities area) into MongoDB.
- `scripts/check-zones.ts` — Queries and displays existing service zones from MongoDB.

There are no test, lint, or dev server commands configured at the infrastructure level. The Next.js app in `src/` has its own `package.json`.

## Architecture

All infrastructure is defined in a single file: `index.ts`. It creates:

1. **ECR Repository** — `portfolio/{appName}`, with lifecycle policy keeping last 10 images
2. **Security Group** — allows ingress on `containerPort` (default 3000) from the ALB only
3. **ALB Target Group** — HTTP health check on `/api/health`
4. **ALB Listener Rule** — host-based HTTPS routing (`{subdomain}.{domainName}`), priority derived from a hash of the subdomain
5. **IAM Policies**:
   - **SES** — `ses:SendEmail`, `ses:SendRawEmail` on the task role (for sending emails)
   - **SSM** — `ssmmessages:*` on the task role (for ECS Exec access)
   - **Secrets Manager** — `secretsmanager:GetSecretValue` on the execution role (to inject `MONGODB_URI` at startup)
6. **ECS Task Definition** — Fargate, with MongoDB Atlas connection via `MONGODB_URI` (from AWS Secrets Manager `mongodb/atlas/uri`) and app-specific env vars (`JWT_SECRET`, `EMAIL_DOMAIN`, `NEXT_PUBLIC_APP_URL`, `AWS_REGION`). ECS Exec is enabled (`enableExecuteCommand: true`).
7. **ECS Service** — FARGATE_SPOT by default with FARGATE fallback, 50%/200% deployment bounds
8. **Scheduled Scaling** (optional) — scales to 0 at night, back up in the morning

### Key requirement for deployed applications

The container **must** expose a `GET /api/health` endpoint returning HTTP 200. Both the ALB target group and the ECS task health check depend on it.

### Container environment variables

| Variable | Source | Description |
|---|---|---|
| `NODE_ENV` | hardcoded | `production` |
| `PORT` | config | Container port (default 3000) |
| `JWT_SECRET` | Pulumi secret | Authentication token signing key |
| `EMAIL_DOMAIN` | config/platform | Domain for outbound emails (falls back to platform domain) |
| `NEXT_PUBLIC_APP_URL` | derived | `https://{subdomain}.{domainName}` |
| `AWS_REGION` | platform | AWS region for SDK calls (SES, etc.) |
| `MONGODB_URI` | Secrets Manager | MongoDB Atlas connection string (injected as ECS secret) |

## Configuration

Stack config lives in `Pulumi.dev.yaml`. Key settings:

| Config Key | Required | Default | Description |
|---|---|---|---|
| `appName` | yes | — | Application name (used for resource naming) |
| `subdomain` | yes | — | Subdomain for ALB host-based routing |
| `platformStack` | yes | — | Pulumi stack reference to shared platform |
| `jwtSecret` | yes | — | Secret for JWT signing (Pulumi encrypted secret) |
| `cpu` | no | `256` | Fargate CPU units |
| `memory` | no | `512` | Fargate memory (MB) |
| `desiredCount` | no | `1` | Number of tasks |
| `containerPort` | no | `3000` | Container port |
| `emailDomain` | no | platform domain | Domain used for outbound SES emails |
| `useFargateSpot` | no | `true` | Use FARGATE_SPOT capacity provider |
| `enableScheduledScaling` | no | `false` | Enable time-based scaling |
| `scaleUpHour` / `scaleDownHour` | no | `6` / `22` | Hours for scheduled scaling |
| `scheduleTimezone` | no | `America/Denver` | Timezone for scheduled scaling |

## CI/CD

GitHub Actions workflow (`.github/workflows/deploy.yml`) triggers on push to `main` or manual dispatch. It builds the Docker image, pushes to ECR (tagged with commit SHA + `latest`), runs `pulumi up`, forces an ECS service update, and waits for stabilization.

Required GitHub secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `PULUMI_ACCESS_TOKEN`.

## Stack Outputs

- `appUrl` — HTTPS URL (`https://{subdomain}.{domainName}`)
- `albUrl` — Direct ALB URL
- `ecrRepositoryUrl` — ECR repository URL for Docker pushes
- `serviceName` / `serviceArn` — ECS service identifiers
