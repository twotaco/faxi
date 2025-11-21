#!/bin/bash

# Faxi Development Startup Script
# This script starts all required services for local development

set -e

echo "🚀 Starting Faxi Development Environment"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"
echo ""

# Start infrastructure services
echo "📦 Starting infrastructure services (Postgres, Redis, MinIO)..."
docker-compose up -d postgres redis minio minio-setup

# Wait for services to be healthy
echo ""
echo "⏳ Waiting for services to be ready..."

# Wait for Postgres
echo -n "  Postgres: "
until docker-compose exec -T postgres pg_isready -U faxi_user -d faxi > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo -e " ${GREEN}✓${NC}"

# Wait for Redis
echo -n "  Redis: "
until docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo -e " ${GREEN}✓${NC}"

# Wait for MinIO
echo -n "  MinIO: "
until curl -f http://localhost:9000/minio/health/live > /dev/null 2>&1; do
    echo -n "."
    sleep 1
done
echo -e " ${GREEN}✓${NC}"

echo ""
echo -e "${GREEN}✓ All infrastructure services are ready!${NC}"
echo ""

# Show service URLs
echo "📍 Service URLs:"
echo "  • Postgres:  localhost:5432"
echo "  • Redis:     localhost:6379"
echo "  • MinIO:     http://localhost:9000 (console: http://localhost:9001)"
echo ""

# Ask if user wants to start the backend
echo "Would you like to start the backend server now? (y/n)"
read -r response

if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo ""
    echo "🔧 Starting backend server..."
    cd backend && npm run dev
else
    echo ""
    echo -e "${YELLOW}ℹ️  Infrastructure is ready. Start the backend with:${NC}"
    echo "   cd backend && npm run dev"
    echo ""
    echo -e "${YELLOW}ℹ️  Start the admin dashboard with:${NC}"
    echo "   cd admin-dashboard && npm run dev"
fi
