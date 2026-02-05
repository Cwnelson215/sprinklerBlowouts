
## Template: `CLAUDE.md`

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A containerized web application deployed on the portfolio platform. Infrastructure is defined with Pulumi (TypeScript) and references shared AWS resources (VPC, ALB, ECS cluster, RDS) from the platform stack via `pulumi.StackReference`.

## Commands

```bash
# Application
npm install           # Install dependencies
npm run dev           # Run locally (http://localhost:3000)
npm run build         # Build for production
npm start             # Start production server

# Infrastructure (Pulumi)
npm run preview       # Preview infra changes
npm run up            # Deploy infra
npm run destroy       # Tear down infra