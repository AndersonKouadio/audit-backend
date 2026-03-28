# ---- Build stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# Install bun for dependency resolution
RUN corepack enable && npm install -g bun

# Copy dependency files
COPY package.json bun.lock ./
COPY prisma ./prisma/

# Install dependencies
RUN bun install --frozen-lockfile

# Generate Prisma client
RUN bunx prisma generate

# Copy source code
COPY . .

# Build NestJS
RUN bun run build

# ---- Production stage ----
FROM node:22-alpine AS production

WORKDIR /app

RUN npm install -g bun

# Copy dependency files and install prod only
COPY package.json bun.lock ./
COPY prisma ./prisma/
RUN bun install --frozen-lockfile --production

# Regenerate Prisma client for production
RUN bunx prisma generate

# Copy built application
COPY --from=builder /app/dist ./dist

# Prisma config pour les migrations en production
RUN echo 'const { defineConfig, env } = require("prisma/config");\
module.exports = defineConfig({\
  schema: "prisma/schema.prisma",\
  migrations: { seed: "node dist/prisma/seed.js" },\
  datasource: { url: env("DATABASE_URL") },\
});' > prisma.config.js

# Create uploads directory
RUN mkdir -p /app/uploads

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/src/main.js"]
