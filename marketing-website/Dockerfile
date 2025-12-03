FROM node:20-alpine

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Set environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000

# Build-time variable for API URL (Next.js requires this at build time)
# IMPORTANT: Do NOT set a default - must be passed via --build-arg
ARG NEXT_PUBLIC_API_URL
RUN if [ -z "$NEXT_PUBLIC_API_URL" ]; then echo "ERROR: NEXT_PUBLIC_API_URL build arg is required" && exit 1; fi
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build Next.js
RUN npm run build

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
