#!/bin/bash

# Admin Dashboard Integration Verification Script
# This script verifies that all admin dashboard pages are accessible and working

set -e

echo "🔍 Admin Dashboard Integration Verification"
echo "==========================================="
echo ""

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:4000}"
ADMIN_DASHBOARD_URL="${ADMIN_DASHBOARD_URL:-http://localhost:4001}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    echo -n "Testing $name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC} (Expected HTTP $expected_status, got $response)"
        ((FAILED++))
    fi
}

# Function to test authenticated endpoint
test_auth_endpoint() {
    local name=$1
    local url=$2
    
    echo -n "Testing $name (auth required)... "
    
    # Test without auth - should return 401
    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
    
    if [ "$response" = "401" ] || [ "$response" = "302" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Protected - HTTP $response)"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC} (Expected 401/302, got $response)"
        ((FAILED++))
    fi
}

echo "1. Backend API Endpoints"
echo "------------------------"
test_endpoint "Backend Health" "$BACKEND_URL/health" 200
test_auth_endpoint "MCP Stats API" "$BACKEND_URL/api/admin/dashboard/mcp/stats"
test_auth_endpoint "AI Metrics API" "$BACKEND_URL/api/admin/dashboard/ai/metrics"
test_auth_endpoint "Health Status API" "$BACKEND_URL/api/admin/dashboard/health/status"
test_auth_endpoint "Analytics API" "$BACKEND_URL/api/admin/dashboard/analytics/overview"
test_auth_endpoint "Audit Logs API" "$BACKEND_URL/api/admin/dashboard/audit/logs"
echo ""

echo "2. Frontend Pages"
echo "-----------------"
test_endpoint "Admin Dashboard Home" "$ADMIN_DASHBOARD_URL" 200
test_endpoint "MCP Page" "$ADMIN_DASHBOARD_URL/mcp" 200
test_endpoint "AI Inspector Page" "$ADMIN_DASHBOARD_URL/ai" 200
test_endpoint "System Health Page" "$ADMIN_DASHBOARD_URL/alerts" 200
test_endpoint "Analytics Page" "$ADMIN_DASHBOARD_URL/analytics" 200
test_endpoint "Audit Logs Page" "$ADMIN_DASHBOARD_URL/audit" 200
echo ""

echo "3. Database Connectivity"
echo "------------------------"
if [ -n "$DATABASE_URL" ]; then
    echo -n "Testing database connection... "
    if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((FAILED++))
    fi
else
    echo -e "${YELLOW}⚠ SKIP${NC} (DATABASE_URL not set)"
fi
echo ""

echo "4. Redis Connectivity"
echo "---------------------"
if command -v redis-cli &> /dev/null; then
    echo -n "Testing Redis connection... "
    if redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}"
        ((FAILED++))
    fi
else
    echo -e "${YELLOW}⚠ SKIP${NC} (redis-cli not available)"
fi
echo ""

echo "==========================================="
echo "Test Results Summary"
echo "==========================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
