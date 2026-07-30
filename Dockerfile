# Stage 1: Install all dependencies (for building)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Install production dependencies only (for runtime)
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci --omit=dev

# Stage 3: Build Next.js + compile server TypeScript
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npx tsc -p tsconfig.server.json

# Stage 4: Production runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Production node_modules
COPY --from=prod-deps /app/node_modules ./node_modules

# Next.js build output + config
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/package.json ./

# Static assets and game data
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data

# Compiled server (dist/server/ → server/) + shared types (dist/src/ → src/)
COPY --from=builder /app/dist/server ./server
COPY --from=builder /app/dist/src ./src

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000

CMD ["node", "server/production.js"]
