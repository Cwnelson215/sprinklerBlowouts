# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY src/package.json src/package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force
COPY src/prisma ./prisma
RUN npx prisma generate

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY src/package.json src/package-lock.json* ./
RUN npm ci
COPY src/ .
RUN npx prisma generate
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN apk add --no-cache curl

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma files for migrations
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/prisma ./prisma

# Fix permissions for Prisma migrations
RUN chown -R nextjs:nodejs node_modules/.prisma node_modules/@prisma node_modules/prisma prisma

# Add migration script
RUN echo '#!/bin/sh' > /app/migrate.sh && \
    echo 'ENCODED_PASS=$(node -e "console.log(encodeURIComponent(process.env.DB_PASSWORD || \"\"))")' >> /app/migrate.sh && \
    echo 'export DATABASE_URL="postgresql://${DB_USER}:${ENCODED_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"' >> /app/migrate.sh && \
    echo 'echo "Running migrations against ${DB_HOST}/${DB_NAME}..."' >> /app/migrate.sh && \
    echo 'node node_modules/prisma/build/index.js migrate deploy' >> /app/migrate.sh && \
    chmod +x /app/migrate.sh && \
    chown nextjs:nodejs /app/migrate.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
