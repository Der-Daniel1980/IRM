# ─── Stage 1: Dependencies ───────────────────────────────────────────────────
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ─── Stage 2: Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time public env vars (baked into the static bundle)
ARG NEXT_PUBLIC_API_URL=/api/v1
ARG NEXT_PUBLIC_KEYCLOAK_URL=/auth
ARG NEXT_PUBLIC_KEYCLOAK_REALM=irm
ARG NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=irm-frontend

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_KEYCLOAK_URL=$NEXT_PUBLIC_KEYCLOAK_URL \
    NEXT_PUBLIC_KEYCLOAK_REALM=$NEXT_PUBLIC_KEYCLOAK_REALM \
    NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=$NEXT_PUBLIC_KEYCLOAK_CLIENT_ID \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ─── Stage 3: Runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache curl

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup -S irm && adduser -S irm -G irm

# Copy standalone server output
COPY --from=builder --chown=irm:irm /app/.next/standalone ./
# Copy static assets
COPY --from=builder --chown=irm:irm /app/.next/static ./.next/static
# Copy public folder
COPY --from=builder --chown=irm:irm /app/public ./public

USER irm

EXPOSE 3000

CMD ["node", "server.js"]
