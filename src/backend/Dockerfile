# Stage 1: Builder
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies and pnpm
RUN apk add --no-cache python3 make g++ \
    && corepack enable \
    && corepack prepare pnpm@8.x --activate

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code and configs
COPY . .

# Generate Prisma client
RUN pnpm prisma:generate

# Build TypeScript code
RUN pnpm build

# Stage 2: Production
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Install production dependencies
RUN apk add --no-cache curl \
    && corepack enable \
    && corepack prepare pnpm@8.x --activate

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built artifacts and package files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml* ./
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Create data directory for SQLite
RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data

# Set security configurations
RUN chmod -R 755 /app \
    && chmod -R 644 /app/dist/* \
    && chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    WS_PORT=3001

# Expose ports
EXPOSE 3000 3001

# Volume for SQLite data
VOLUME ["/app/data"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Resource limits
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Start application
CMD ["node", "dist/server.js"]