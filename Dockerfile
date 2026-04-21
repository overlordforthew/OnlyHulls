FROM node:20-alpine AS base

# --- Dependencies ---
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- Build ---
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG PUBLIC_MAP_ENABLED=false
ARG NEXT_PUBLIC_MAP_ENABLED=false
ARG NEXT_PUBLIC_MAP_STYLE_URL=
ARG NEXT_PUBLIC_MAP_ATTRIBUTION=
ARG NEXT_PUBLIC_MAP_RESOURCE_ORIGINS=
ENV NEXT_TELEMETRY_DISABLED=1
ENV PUBLIC_MAP_ENABLED=$PUBLIC_MAP_ENABLED
ENV NEXT_PUBLIC_MAP_ENABLED=$NEXT_PUBLIC_MAP_ENABLED
ENV NEXT_PUBLIC_MAP_STYLE_URL=$NEXT_PUBLIC_MAP_STYLE_URL
ENV NEXT_PUBLIC_MAP_ATTRIBUTION=$NEXT_PUBLIC_MAP_ATTRIBUTION
ENV NEXT_PUBLIC_MAP_RESOURCE_ORIGINS=$NEXT_PUBLIC_MAP_RESOURCE_ORIGINS
RUN npm run build

# --- Runner ---
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 80
ENV PORT=80
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
