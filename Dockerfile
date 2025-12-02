# Production stage - simplified for QA
FROM node:20-alpine AS production

# Install runtime dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    pkgconfig \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    fontconfig \
    ttf-dejavu

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S faxi -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm ci

# Copy backend source
COPY --chown=faxi:nodejs backend ./backend

# Create directories for runtime data
RUN mkdir -p /app/backend/data/uploads /app/backend/data/logs && \
    chown -R faxi:nodejs /app/backend/data

# Switch to non-root user
USER faxi

# Set working directory to backend
WORKDIR /app/backend

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', (res) => { \
        process.exit(res.statusCode === 200 ? 0 : 1) \
    }).on('error', () => process.exit(1))"

# Start application with tsx (TypeScript execution)
CMD ["npx", "tsx", "src/index.ts"]