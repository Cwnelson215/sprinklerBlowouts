# Sprinkler Blowout

A Pulumi (TypeScript) infrastructure repository that deploys the Sprinkler Blowouts application to AWS ECS/Fargate.

> **Note:** This repo contains only infrastructure code. The application source code lives elsewhere and is built into a Docker image that this infrastructure deploys.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [Pulumi CLI](https://www.pulumi.com/docs/install/)
- AWS credentials configured (`aws configure` or environment variables)

## Commands

```bash
npm install           # Install dependencies
npm run build         # Compile TypeScript (tsc)
npm run preview       # Preview infrastructure changes (pulumi preview)
npm run up            # Deploy infrastructure (pulumi up)
npm run destroy       # Tear down infrastructure (pulumi destroy)
```

## Architecture

All infrastructure is defined in `index.ts`. It creates:

1. **ECR Repository** — `portfolio/{appName}`, with lifecycle policy keeping last 10 images
2. **Security Group** — allows ingress on `containerPort` (default 3000) from the ALB only
3. **ALB Target Group** — HTTP health check on `/health`
4. **ALB Listener Rule** — host-based HTTPS routing (`{subdomain}.{domainName}`)
5. **ECS Task Definition** — Fargate, with optional RDS database env vars and secrets
6. **ECS Service** — FARGATE_SPOT by default with FARGATE fallback
7. **Scheduled Scaling** (optional) — scales to 0 at night, back up in the morning

This repo references shared AWS resources (VPC, ALB, ECS cluster, RDS, IAM roles, CloudWatch) from a platform stack via `pulumi.StackReference`.

### Health Check Requirement

The container **must** expose a `GET /health` endpoint returning HTTP 200. Both the ALB target group and the ECS task health check depend on it.

## Configuration

Stack config lives in `Pulumi.dev.yaml`. Key settings:

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

GitHub Actions workflow (`.github/workflows/deploy.yml`) triggers on push to `main` or manual dispatch. It:

1. Builds the Docker image
2. Pushes to ECR (tagged with commit SHA + `latest`)
3. Runs `pulumi up`
4. Forces an ECS service update

**Required GitHub secrets:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `PULUMI_ACCESS_TOKEN`

## Stack Outputs

- `appUrl` — HTTPS URL (`https://{subdomain}.{domainName}`)
- `albUrl` — Direct ALB URL
- `ecrRepositoryUrl` — ECR repository URL for Docker pushes
- `serviceName` / `serviceArn` — ECS service identifiers
