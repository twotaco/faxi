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

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
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
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=faxi:nodejs /app/dist ./dist
COPY --from=builder --chown=faxi:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=faxi:nodejs /app/package*.json ./

# Copy static assets if any
COPY --chown=faxi:nodejs src/test/testUI.html ./dist/test/
COPY --chown=faxi:nodejs src/test/fixtures ./dist/test/fixtures

# Create directories for runtime data
RUN mkdir -p /app/data/uploads /app/data/logs && \
    chown -R faxi:nodejs /app/data

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