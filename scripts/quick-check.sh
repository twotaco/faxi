#!/bin/bash

# Ultra-simple service checker - just checks if ports are listening

echo "🔍 Quick Service Check"
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

check_port() {
    local port=$1
    local name=$2
    local url=$3
    
    if lsof -i :$port > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $name (port $port)${NC} - $url"
    else
        echo -e "${RED}❌ $name (port $port)${NC}"
    fi
}

check_port 5432 "Postgres    " "localhost:5432"
check_port 6379 "Redis       " "localhost:6379"
check_port 9000 "MinIO       " "http://localhost:9000"
check_port 4000 "Backend     " "http://localhost:4000"
check_port 4001 "Admin Dash  " "http://localhost:4001"

echo ""
echo "💡 To start missing services:"
echo "   docker-compose up -d postgres redis minio"
echo "   cd backend && npm run dev"
echo "   cd admin-dashboard && npm run dev"
