# Production stage with Playwright support
FROM mcr.microsoft.com/playwright:v1.57.0-noble AS production

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

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm ci

# Copy backend source
COPY backend ./backend

# Create directories for runtime data (as root, before switching user)
RUN mkdir -p /app/backend/data/uploads /app/backend/data/logs /app/backend/logs /app/backend/test-faxes /tmp/fax-processing && \
    chown -R pwuser:pwuser /app /tmp/fax-processing

# Switch to non-root user (pwuser is the default user in Playwright image)
USER pwuser

# Set working directory to backend
WORKDIR /app/backend

# Expose port
EXPOSE 4000

# Start application with tsx (TypeScript execution)
CMD ["npx", "tsx", "src/index.ts"]
