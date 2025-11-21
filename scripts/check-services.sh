#!/bin/bash

# Quick service status checker
# Run this to see what's running and what's not

echo "🔍 Checking Faxi Services Status"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check Docker
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker: Not running${NC}"
    DOCKER_OK=false
else
    echo -e "${GREEN}✓ Docker: Running${NC}"
    DOCKER_OK=true
fi

if [ "$DOCKER_OK" = true ]; then
    # Check Postgres
    if docker-compose ps postgres 2>/dev/null | grep -q "Up"; then
        if timeout 2 docker-compose exec -T postgres pg_isready -U faxi_user -d faxi > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Postgres: Running and healthy (localhost:5432)${NC}"
        else
            echo -e "${YELLOW}⚠ Postgres: Running but not ready${NC}"
        fi
    else
        echo -e "${RED}❌ Postgres: Not running${NC}"
    fi

    # Check Redis
    if docker-compose ps redis 2>/dev/null | grep -q "Up"; then
        if timeout 2 docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Redis: Running and healthy (localhost:6379)${NC}"
        else
            echo -e "${YELLOW}⚠ Redis: Running but not ready${NC}"
        fi
    else
        echo -e "${RED}❌ Redis: Not running${NC}"
    fi

    # Check MinIO
    if docker-compose ps minio 2>/dev/null | grep -q "Up"; then
        if timeout 2 curl -f http://localhost:9000/minio/health/live > /dev/null 2>&1; then
            echo -e "${GREEN}✓ MinIO: Running and healthy (http://localhost:9000)${NC}"
        else
            echo -e "${YELLOW}⚠ MinIO: Running but not ready${NC}"
        fi
    else
        echo -e "${RED}❌ MinIO: Not running${NC}"
    fi
fi

# Check Backend
if lsof -i :4000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend: Running (http://localhost:4000)${NC}"
else
    echo -e "${RED}❌ Backend: Not running${NC}"
fi

# Check Admin Dashboard
if lsof -i :4001 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Admin Dashboard: Running (http://localhost:4001)${NC}"
else
    echo -e "${RED}❌ Admin Dashboard: Not running${NC}"
fi

echo ""
echo "💡 Quick commands:"
echo "  Start infrastructure:  docker-compose up -d postgres redis minio"
echo "  Start backend:         cd backend && npm run dev"
echo "  Start admin:           cd admin-dashboard && npm run dev"
echo "  Stop all:              docker-compose down"
