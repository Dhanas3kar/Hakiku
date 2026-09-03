# Multi-stage Dockerfile for Hakiku NestJS API

# Stage 1: Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Copy root workspace and api dependencies
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm ci

# Copy API source and build
COPY apps/api ./apps/api
WORKDIR /app/apps/api
RUN npm run build

# Stage 2: Production Lightweight Runner Stage
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Run container as non-root user
USER node

# Copy package descriptors and production dependencies
COPY --chown=node:node package*.json ./
COPY --chown=node:node apps/api/package*.json ./apps/api/
RUN npm ci --only=production

# Copy compiled build output from builder
COPY --chown=node:node --from=builder /app/apps/api/dist ./apps/api/dist
COPY --chown=node:node --from=builder /app/apps/api/drizzle ./apps/api/drizzle

WORKDIR /app/apps/api

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health/readiness', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); });"

CMD ["node", "dist/main.js"]
