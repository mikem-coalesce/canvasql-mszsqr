# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install pnpm globally with specific version for consistency
RUN npm install -g pnpm@8.x

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Enable pnpm store for caching
ENV PNPM_HOME="/app/.pnpm-store"
RUN pnpm config set store-dir $PNPM_HOME

# Install dependencies with frozen lockfile for reproducible builds
RUN pnpm install --frozen-lockfile

# Copy source files (respect .dockerignore)
COPY . .

# Run type checking in parallel with build
RUN pnpm run type-check & \
    pnpm run build

# Production stage
FROM nginx:1.25-alpine

# Create nginx user/group with limited privileges
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx configuration files
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/ssl.conf /etc/nginx/ssl.conf
COPY nginx/security-headers.conf /etc/nginx/security-headers.conf

# Set up health check endpoint
RUN echo "health_check" > /usr/share/nginx/html/health

# Configure environment variables
ENV NODE_ENV=production
ENV NGINX_WORKER_PROCESSES=auto
ENV NGINX_WORKER_CONNECTIONS=1024

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Switch to non-root user
USER nginx

# Expose ports
EXPOSE 80 443

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Set resource limits
ENV NGINX_WORKER_RLIMIT_NOFILE=1024

# Security options
ENV NGINX_READ_ONLY_ROOT=true
ENV NGINX_NO_NEW_PRIVILEGES=true

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]