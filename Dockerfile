# Production stage with Playwright support
FROM mcr.microsoft.com/playwright:v1.52.0-noble AS production

# Install additional runtime dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    pkg-config \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    libpixman-1-dev \
    libjpeg-turbo8-dev \
    libfreetype6-dev \
    fontconfig \
    fonts-dejavu \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app user for security
RUN groupadd -g 1001 nodejs && \
    useradd -m -s /bin/bash -u 1001 -g nodejs faxi

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
RUN mkdir -p /app/backend/data/uploads /app/backend/data/logs /app/backend/logs /app/backend/test-faxes /tmp/fax-processing && \
    chown -R faxi:nodejs /app/backend/data /app/backend/logs /app/backend/test-faxes /tmp/fax-processing

# Create playwright cache directory with correct permissions
RUN mkdir -p /home/faxi/.cache && chown -R faxi:nodejs /home/faxi

# Switch to non-root user
USER faxi

# Set working directory to backend
WORKDIR /app/backend

# Expose port
EXPOSE 4000

# Start application with tsx (TypeScript execution)
CMD ["npx", "tsx", "src/index.ts"]
