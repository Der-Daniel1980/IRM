# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Required for Puppeteer / native addons
RUN apk add --no-cache python3 make g++ openssl

WORKDIR /app

# Copy manifests first for better layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Compile TypeScript → dist/
RUN npm run build

# ─── Stage 2: Runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl curl \
    # pg_dump für Admin-Backup (muss zur Postgres-16-Server-Version passen)
    postgresql16-client \
    # Puppeteer dependencies
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to use system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json ./

# Install production-only dependencies
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Copy Prisma schema + migrations (needed for prisma migrate deploy at startup)
COPY --from=builder /app/prisma ./prisma

# Copy generated Prisma client (overwrite the one from npm ci)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Non-root user for security
RUN addgroup -S irm && adduser -S irm -G irm \
    && mkdir -p /app/uploads/photos \
    && chown -R irm:irm /app
USER irm

EXPOSE 3001

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
