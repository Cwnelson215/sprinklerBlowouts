# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A combined infrastructure + application repository for a sprinkler services platform supporting **Sprinkler Blowout** (SB) and **Backflow Prevention Testing** (BF). It contains:

- **`src/`** — A full Next.js (App Router) application with admin dashboard, route optimization, background job processing, and email notifications for scheduling sprinkler service appointments.
- **`index.ts`** — Pulumi (TypeScript) infrastructure that deploys the containerized app to AWS ECS/Fargate.
- **`Dockerfile`** — Multi-stage build that produces a Next.js standalone production image.

This repo references shared AWS resources (VPC, ALB, ECS cluster, IAM roles, CloudWatch) from a platform stack via `pulumi.StackReference`.

## Commands

### Infrastructure (root)

```bash
npm install                  # Install dependencies (infrastructure)
npm run build                # Compile TypeScript (tsc)
npm run preview              # Preview infrastructure changes (pulumi preview)
npm run up                   # Deploy infrastructure (pulumi up)
npm run destroy              # Tear down infrastructure (pulumi destroy)
npm run seed:zone            # Seed service zone data into MongoDB
npm run seed:bookings        # Seed test booking data into MongoDB
npm run migrate:service-type # Add serviceType field to legacy documents
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

### Utility Scripts

- `scripts/seed-zone.ts` — Seeds the service zone (Tri-Cities area) into MongoDB.
- `scripts/check-zones.ts` — Queries and displays existing service zones from MongoDB.
- `scripts/seed-bookings.ts` — Seeds test booking data (35 customers across 7 geographic clusters) into MongoDB.
- `scripts/migrate-service-type.ts` — One-time migration to add `serviceType: "SPRINKLER_BLOWOUT"` to legacy documents in bookings, available_dates, and route_groups.

## Infrastructure Architecture

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

## Application Architecture

### Service Types

Defined in `src/lib/types.ts`, configured in `src/lib/service-config.ts`:

- **SPRINKLER_BLOWOUT** (prefix: `SB`) — Winterization service to protect irrigation systems from freeze damage
- **BACKFLOW_TESTING** (prefix: `BF`) — Annual backflow preventer testing for water supply compliance

Each service type has its own label, description, booking headings, and email templates via `getServiceConfig()`.

### Customer Booking Flow

1. Select service type on the home page
2. Enter address and validate it's within a service zone
3. Choose an available date/time slot
4. Provide contact information
5. Receive confirmation with a job number for lookup

Customers can look up existing bookings by job number at `/lookup/[jobNumber]`.

### Admin Features

- **Authentication** — JWT-based login (`src/lib/auth.ts`), roles: `SUPER_ADMIN`, `OPERATOR`
- **Dashboard** — Booking stats and overview (`/admin`)
- **Bookings** — View and manage all bookings (`/admin/bookings`)
- **Availability** — Configure available dates and time slots (`/admin/availability`)
- **Routes** — Route optimization and management (`/admin/routes`)
- **Zones** — Service zone management with map interface (`/admin/zones`)

### Server Initialization

`src/instrumentation.ts` — Next.js instrumentation hook that starts the background job queue polling when the server boots (production only).

### Security Headers

`src/next.config.js` includes security headers (Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, etc.) applied to all responses.

### UI Components (`src/components/`)

- **`components/admin/`** — Admin UI (layout, availability calendar, route map, etc.)
- **`components/booking/`** — Booking flow (calendar, form, time grid)
- **`components/ui/`** — Reusable primitives (badge, button, calendar, card, input, modal, select)

### Background Job Queue

MongoDB-backed job queue (`src/lib/queue.ts`) with polling-based processing:

| Job Name | Worker | Description |
|---|---|---|
| `geocode-address` | `geocode-worker.ts` | Geocode booking addresses after creation |
| `assign-route-group` | `route-worker.ts` | Assign bookings to route groups |
| `optimize-routes` | `route-worker.ts` | Optimize route ordering |
| `send-email` | `email-worker.ts` | Send transactional emails |
| `send-reminders` | `email-worker.ts` | Send scheduled reminder emails |

Jobs support priority, retry with exponential backoff (max 3 attempts), and recurring schedules.

### Geocoding

`src/lib/geocode.ts` — Two providers with automatic fallback:

1. **US Census Bureau** (primary) — Free, no API key required
2. **OpenCage** (fallback) — Used only if `OPENCAGE_API_KEY` is set

### Email Notifications

SES-based email sending (`src/lib/email/ses.ts`) with HTML templates (`src/lib/email/templates.ts`). Email types: confirmation, reminder, update, cancellation. All sends are logged to the `email_logs` collection.

### Key Lib Files

| File | Purpose |
|---|---|
| `lib/types.ts` | Type definitions, enums, document interfaces |
| `lib/service-config.ts` | Per-service-type configuration and labels |
| `lib/mongodb.ts` | MongoDB client connection |
| `lib/auth.ts` | JWT authentication and middleware |
| `lib/validation.ts` | Zod schemas for input validation |
| `lib/queue.ts` | Background job queue |
| `lib/geocode.ts` | Address geocoding |
| `lib/route-optimizer.ts` | Route optimization logic |
| `lib/clustering.ts` | Geographic clustering for bookings |
| `lib/time-slots.ts` | Time slot generation and management |
| `lib/constants.ts` | Shared constants |
| `lib/utils.ts` | General utilities |
| `lib/route-export.ts` | Route data export |
| `lib/rate-limit.ts` | In-memory rate limiting with configurable windows |
| `lib/security.ts` | Regex escaping, error sanitization, pagination clamping, ObjectId validation |
| `lib/use-osrm-route.ts` | OSRM routing hook |

### MongoDB Collections

| Collection | Description |
|---|---|
| `bookings` | Customer booking records |
| `available_dates` | Configurable date/time slots per zone and service type |
| `service_zones` | Geographic service areas |
| `route_groups` | Optimized route groupings |
| `admin_users` | Admin accounts (hashed passwords) |
| `email_logs` | Sent email audit trail |
| `jobs` | Background job queue |

## Testing

Uses **Vitest** with **mongodb-memory-server** for isolated integration tests.

- Config: `src/vitest.config.ts`
- Setup: `src/test/setup.ts` — starts in-memory MongoDB, seeds env vars, cleans all collections between tests
- Test helpers: `src/test/helpers/` — `auth.ts`, `db.ts`, `request.ts`
- Coverage targets: `lib/**` and `app/api/**` (v8 provider)
- 26 test files: 12 lib unit tests (`src/lib/__tests__/`), 12 API route tests (`src/app/api/**/__tests__/`), and 2 page-level tests (`src/app/lookup/__tests__/`, `src/app/lookup/[jobNumber]/__tests__/`)

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
2. **build-and-deploy** (depends on test passing) — Builds the Docker image, pushes to ECR (tagged with commit SHA + `latest`), runs `pulumi up`, forces an ECS service update, and waits for stabilization

Required GitHub secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `PULUMI_ACCESS_TOKEN`.

## Stack Outputs

- `appUrl` — HTTPS URL (`https://{subdomain}.{domainName}`)
- `albUrl` — Direct ALB URL
- `ecrRepositoryUrl` — ECR repository URL for Docker pushes
- `serviceName` / `serviceArn` — ECS service identifiers
