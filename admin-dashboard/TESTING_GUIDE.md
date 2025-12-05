# Admin Dashboard Testing Guide

Quick reference for running tests and verifying the admin dashboard implementation.

## Prerequisites

- Node.js 20+
- PostgreSQL running
- Redis running
- Backend dependencies installed (`npm install`)
- Admin dashboard dependencies installed (`cd admin-dashboard && npm install`)

## Running Automated Tests

### Backend Tests

#### Run All Admin Dashboard Tests
```bash
cd backend
npx vitest run adminDashboard
```

#### Run Integration Tests Only
```bash
cd backend
npx vitest run adminDashboardController.integration
```

#### Run Authentication Tests Only
```bash
cd backend
npx vitest run adminDashboardAuth
```

#### Run Unit Tests Only
```bash
cd backend
npx vitest run adminDashboardController.test
```

#### Run Database Index Verification
```bash
cd backend
npx vitest run verify_indexes
```

#### Run All Tests with Coverage
```bash
cd backend
npm test -- --coverage
```

### Frontend Tests

#### Run All Frontend Tests
```bash
cd admin-dashboard
npm test
```

#### Run Integration Tests
```bash
cd admin-dashboard
npm test -- integration.test
```

#### Run Responsive Layout Tests
```bash
cd admin-dashboard
npm test -- responsive.test
```

## Integration Verification

### Automated Verification Script
```bash
cd admin-dashboard
./verify-integration.sh
```

This script checks:
- Backend API endpoints accessibility
- Frontend pages loading
- Database connectivity
- Redis connectivity

### Manual Verification

1. **Start the backend:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start the admin dashboard:**
   ```bash
   cd admin-dashboard
   npm run dev
   ```

3. **Access the pages:**
   - MCP Servers: http://localhost:4001/mcp
   - AI Inspector: http://localhost:4001/ai
   - System Health: http://localhost:4001/alerts
   - Analytics: http://localhost:4001/analytics
   - Audit Logs: http://localhost:4001/audit

## Test Results Interpretation

### Expected Output

All tests should pass with output similar to:
```
✓ src/controllers/adminDashboardController.integration.test.ts (18)
✓ src/controllers/adminDashboardAuth.test.ts (20)
✓ src/controllers/adminDashboardController.test.ts (12)

Test Files  3 passed (3)
Tests  50 passed (50)
```

### Common Issues

#### Database Connection Errors
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution:** Ensure PostgreSQL is running
```bash
docker-compose up -d postgres
```

#### Redis Connection Errors
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solution:** Ensure Redis is running
```bash
docker-compose up -d redis
```

#### Authentication Errors
```
Error: Invalid access token
```
**Solution:** This is expected for authentication tests. They verify that endpoints are properly protected.

## Manual Testing Checklist

See `INTEGRATION_TEST_CHECKLIST.md` for comprehensive manual testing steps covering:
- Authentication
- Data display
- Empty states
- Error handling
- Responsive layout
- Browser compatibility

## Performance Testing

### API Response Time Testing
```bash
# Test MCP Stats endpoint
time curl http://localhost:4000/api/admin/dashboard/mcp/stats

# Test AI Metrics endpoint
time curl http://localhost:4000/api/admin/dashboard/ai/metrics

# Test Health Status endpoint
time curl http://localhost:4000/api/admin/dashboard/health/status

# Test Analytics endpoint
time curl http://localhost:4000/api/admin/dashboard/analytics/overview

# Test Audit Logs endpoint
time curl http://localhost:4000/api/admin/dashboard/audit/logs
```

All endpoints should respond in < 500ms.

### Database Query Performance
```bash
cd backend
npm run migrate
# Check query execution plans in PostgreSQL
psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT * FROM audit_logs WHERE event_type = 'mcp.tool_call' ORDER BY created_at DESC LIMIT 100;"
```

## Continuous Integration

### Pre-commit Checks
```bash
# Run all tests
cd backend && npm test
cd admin-dashboard && npm test

# Type checking
cd backend && npm run typecheck
cd admin-dashboard && npm run typecheck

# Linting
cd admin-dashboard && npm run lint
```

### Pre-deployment Checks
```bash
# 1. Run all automated tests
cd backend && npm test

# 2. Verify database indexes
cd backend && npx vitest run verify_indexes

# 3. Run integration verification
cd admin-dashboard && ./verify-integration.sh

# 4. Build for production
cd backend && npm run build
cd admin-dashboard && npm run build

# 5. Check for TypeScript errors
cd backend && npm run typecheck
cd admin-dashboard && npm run typecheck
```

## Debugging Tests

### Run Tests in Watch Mode
```bash
cd backend
npm run test:watch
```

### Run Specific Test File
```bash
cd backend
npx vitest run src/controllers/adminDashboardController.test.ts
```

### Run Tests with Verbose Output
```bash
cd backend
npx vitest run --reporter=verbose
```

### Debug with Node Inspector
```bash
cd backend
node --inspect-brk node_modules/.bin/vitest run
```

## Test Data Setup

### Generate Test Fixtures
```bash
cd backend
npm run generate-fixtures
```

### Seed Test Database
```bash
cd backend
npm run migrate
# Add test data manually or via seed script
```

## Coverage Reports

### Generate Coverage Report
```bash
cd backend
npm test -- --coverage
```

Coverage reports will be generated in `backend/coverage/` directory.

### View Coverage in Browser
```bash
cd backend
npm test -- --coverage
open coverage/index.html
```

## Troubleshooting

### Tests Timing Out
Increase timeout in vitest.config.ts:
```typescript
export default defineConfig({
  test: {
    testTimeout: 30000, // 30 seconds
  },
});
```

### Memory Issues
Increase Node.js memory:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm test
```

### Port Conflicts
Change test ports in environment variables:
```bash
TEST_PORT=3002 npm test
```

## Additional Resources

- **Test Summary:** See `TEST_SUMMARY.md`
- **Manual Testing:** See `INTEGRATION_TEST_CHECKLIST.md`
- **Task Completion:** See `.kiro/specs/admin-dashboard-quick-wins/TASK_8_COMPLETION.md`
- **Final Summary:** See `.kiro/specs/admin-dashboard-quick-wins/FINAL_SUMMARY.md`

## Quick Commands Reference

```bash
# Run all backend tests
cd backend && npm test

# Run all frontend tests
cd admin-dashboard && npm test

# Verify integration
cd admin-dashboard && ./verify-integration.sh

# Check database indexes
cd backend && npx vitest run verify_indexes

# Run with coverage
cd backend && npm test -- --coverage

# Watch mode
cd backend && npm run test:watch
```

---

**Last Updated:** December 5, 2024
**Test Framework:** Vitest 1.6.1
**Total Tests:** 50 automated tests
**Success Rate:** 100%
