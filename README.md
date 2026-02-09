# Sprinkler Blowout

A combined infrastructure + application repository for the Sprinkler Blowouts service. The `src/` directory contains a full **Next.js** application for scheduling sprinkler blowout appointments, and `index.ts` defines the **Pulumi (TypeScript)** infrastructure that deploys it to AWS ECS/Fargate.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [Pulumi CLI](https://www.pulumi.com/docs/install/)
- AWS credentials configured (`aws configure` or environment variables)

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

## Architecture

All infrastructure is defined in `index.ts`. It creates:

1. **ECR Repository** — `portfolio/{appName}`, with lifecycle policy keeping last 10 images
2. **Security Group** — allows ingress on `containerPort` (default 3000) from the ALB only
3. **ALB Target Group** — HTTP health check on `/api/health`
4. **ALB Listener Rule** — host-based HTTPS routing (`{subdomain}.{domainName}`)
5. **IAM Policies**:
   - **SES** — `ses:SendEmail`, `ses:SendRawEmail` on the task role (for sending emails)
   - **SSM** — `ssmmessages:*` on the task role (for ECS Exec access)
   - **Secrets Manager** — `secretsmanager:GetSecretValue` on the execution role (to inject `MONGODB_URI` at startup)
6. **ECS Task Definition** — Fargate, with MongoDB Atlas connection via `MONGODB_URI` (from AWS Secrets Manager) and app-specific env vars. ECS Exec is enabled.
7. **ECS Service** — FARGATE_SPOT by default with FARGATE fallback
8. **Scheduled Scaling** (optional) — scales to 0 at night, back up in the morning

This repo references shared AWS resources (VPC, ALB, ECS cluster, IAM roles, CloudWatch) from a platform stack via `pulumi.StackReference`.

### Health Check Requirement

The container **must** expose a `GET /api/health` endpoint returning HTTP 200. Both the ALB target group and the ECS task health check depend on it.

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

GitHub Actions workflow (`.github/workflows/deploy.yml`) triggers on push to `main` or manual dispatch. It:

1. Builds the Docker image
2. Pushes to ECR (tagged with commit SHA + `latest`)
3. Runs `pulumi up`
4. Forces an ECS service update
5. Waits for deployment to stabilize

**Required GitHub secrets:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `PULUMI_ACCESS_TOKEN`

## Stack Outputs

- `appUrl` — HTTPS URL (`https://{subdomain}.{domainName}`)
- `albUrl` — Direct ALB URL
- `ecrRepositoryUrl` — ECR repository URL for Docker pushes
- `serviceName` / `serviceArn` — ECS service identifiers
