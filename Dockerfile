# Multi-stage build for production optimization
FROM node:20-alpine AS builder

# Install build dependencies for native modules (canvas, sharp)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

# Set working directory
WORKDIR /app

# Copy root package files for workspace setup
COPY package*.json ./

# Copy backend workspace
COPY backend ./backend

# Install all workspace dependencies
RUN npm ci --only=production

# Build backend TypeScript
WORKDIR /app/backend
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies for native modules
RUN apk add --no-cache \
    cairo \
    jpeg \
    pango \
    musl \
    giflib \
    pixman \
    pangomm \
    libjpeg-turbo \
    freetype \
    fontconfig \
    ttf-dejavu

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S faxi -u 1001

# Set working directory
WORKDIR /app/backend

# Copy built application from builder stage
COPY --from=builder --chown=faxi:nodejs /app/backend/dist ./dist
COPY --from=builder --chown=faxi:nodejs /app/backend/node_modules ./node_modules
COPY --from=builder --chown=faxi:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=faxi:nodejs /app/backend/package*.json ./

# Copy static assets if any
COPY --chown=faxi:nodejs backend/src/test/testUI.html ./dist/test/
COPY --chown=faxi:nodejs backend/src/test/fixtures ./dist/test/fixtures

# Create directories for runtime data
RUN mkdir -p /app/backend/data/uploads /app/backend/data/logs && \
    chown -R faxi:nodejs /app/backend/data

# Switch to non-root user
USER faxi

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { \
        process.exit(res.statusCode === 200 ? 0 : 1) \
    }).on('error', () => process.exit(1))"

# Start application
CMD ["node", "dist/index.js"]