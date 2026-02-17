# Sprinkler Services

A combined infrastructure + application repository for a sprinkler services platform. The `src/` directory contains a full **Next.js** application supporting **Sprinkler Blowout** and **Backflow Prevention Testing** appointments, and `index.ts` defines the **Pulumi (TypeScript)** infrastructure that deploys it to AWS ECS/Fargate.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [MongoDB](https://www.mongodb.com/) (local instance or Atlas connection string)
- [Pulumi CLI](https://www.pulumi.com/docs/install/)
- AWS credentials configured (`aws configure` or environment variables)

## Features

- **Two service types** — Sprinkler Blowout (winterization) and Backflow Prevention Testing (compliance)
- **5-step booking flow** — Service selection, address validation, date/time picker, contact info, confirmation
- **Booking lookup** — Customers can check booking status by job number
- **Admin dashboard** — Stats overview, booking management, availability configuration
- **Route optimization** — Geographic clustering and route ordering for service crews
- **Background jobs** — MongoDB-backed queue for geocoding, route assignment, and emails
- **Email notifications** — SES-powered confirmation, reminder, update, and cancellation emails

## Local Development

1. Install dependencies:
   ```bash
   npm install          # Root (infrastructure)
   cd src && npm install  # Application
   ```

2. Create `src/.env.local` with:
   ```
   MONGODB_URI=mongodb://localhost:27017/sprinklerBlowouts
   JWT_SECRET=your-dev-secret
   EMAIL_DOMAIN=yourdomain.com
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

3. Seed the database:
   ```bash
   npm run seed:zone       # Create the service zone
   npm run seed:bookings   # Create test booking data (optional)
   ```

4. Start the dev server:
   ```bash
   cd src && npm run dev
   ```

## Commands

### Infrastructure (root)

```bash
npm install                  # Install dependencies (infrastructure)
npm run build                # Compile TypeScript (tsc)
npm run preview              # Preview infrastructure changes (pulumi preview)
npm run up                   # Deploy infrastructure (pulumi up)
npm run destroy              # Tear down infrastructure (pulumi destroy)
```

### Application (from `src/`)

```bash
npm run dev            # Start Next.js dev server
npm run build          # Build Next.js for production
npm run start          # Start production server
npm run test           # Run tests (vitest run)
npm run test:watch     # Run tests in watch mode (vitest)
npm run test:coverage  # Run tests with coverage (vitest run --coverage)
```

### Scripts (root)

```bash
npm run seed:zone            # Seed service zone data into MongoDB
npm run seed:bookings        # Seed test booking data into MongoDB
npm run migrate:service-type # Add serviceType field to legacy documents
```

- `scripts/seed-zone.ts` — Seeds the service zone (Tri-Cities area) into MongoDB.
- `scripts/check-zones.ts` — Queries and displays existing service zones from MongoDB.
- `scripts/seed-bookings.ts` — Seeds test booking data (35 customers across 7 geographic clusters) into MongoDB.
- `scripts/migrate-service-type.ts` — One-time migration to add `serviceType` to legacy documents.

## Architecture

### Infrastructure

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

### Application

```
src/
├── app/
│   ├── page.tsx                    # Home — service type selection
│   ├── booking/                    # Customer booking flow
│   ├── lookup/[jobNumber]/         # Booking status lookup
│   ├── admin/                      # Admin dashboard, bookings, availability, routes, zones
│   └── api/                        # API routes (bookings, availability, health, admin/*)
├── components/                     # React components
├── lib/
│   ├── types.ts                    # Type definitions and enums
│   ├── service-config.ts           # Per-service-type configuration
│   ├── mongodb.ts                  # Database connection
│   ├── auth.ts                     # JWT authentication
│   ├── validation.ts               # Zod input validation
│   ├── queue.ts                    # Background job queue
│   ├── geocode.ts                  # Address geocoding (Census Bureau + OpenCage fallback)
│   ├── route-optimizer.ts          # Route optimization
│   ├── clustering.ts               # Geographic clustering
│   ├── time-slots.ts               # Time slot management
│   ├── email/                      # SES email sending and HTML templates
│   └── workers/                    # Job handlers (geocode, route, email)
└── test/                           # Test setup and helpers
```

### MongoDB Collections

| Collection | Description |
|---|---|
| `bookings` | Customer booking records |
| `available_dates` | Configurable date/time slots per zone and service type |
| `service_zones` | Geographic service areas |
| `route_groups` | Optimized route groupings |
| `admin_users` | Admin accounts |
| `email_logs` | Sent email audit trail |
| `jobs` | Background job queue |

## Testing

Uses **Vitest** with **mongodb-memory-server** for isolated integration tests. Collections are cleaned between each test for full isolation.

```bash
cd src
npm test               # Run all 22 tests (10 lib + 12 API route)
npm run test:watch     # Watch mode
npm run test:coverage  # With v8 coverage (lib/** and app/api/**)
```

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

GitHub Actions workflow (`.github/workflows/deploy.yml`) triggers on push to `main` or manual dispatch. It runs two jobs:

1. **test** — Installs app dependencies in `src/` and runs `npm test`
2. **build-and-deploy** (depends on test passing):
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
