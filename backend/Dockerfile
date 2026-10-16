# syntax=docker/dockerfile:1.7

# ---- Base image with pnpm and node ----
FROM node:20-slim AS base

# Ensure production defaults at runtime
ENV NODE_ENV=production \
    PNPM_HOME=/root/.local/share/pnpm

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate

WORKDIR /app

# ---- Dependencies ----
FROM base AS deps

# Install system deps if needed (openssl for node-gyp, etc.)
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    openssl \
    python3 \
    build-essential \
  && rm -rf /var/lib/apt/lists/*

# Copy lockfiles and manifests to leverage Docker layer caching
COPY package.json pnpm-lock.yaml* package-lock.json* yarn.lock* ./

# Prefer npm if lockfile exists, else pnpm
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then \
      npm ci; \
    elif [ -f yarn.lock ]; then \
      corepack prepare yarn@4.5.1 --activate && yarn install --immutable; \
    else \
      npm install; \
    fi

# ---- Build ----
FROM deps AS build

COPY . .

# Build the NestJS app
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm run build; \
    elif [ -f package-lock.json ]; then \
      npm run build; \
    else \
      corepack prepare yarn@4.5.1 --activate && yarn build; \
    fi

# ---- Production runtime ----
FROM base AS runtime

WORKDIR /app

# Copy only the required artifacts
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Default port
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/main.js"]


