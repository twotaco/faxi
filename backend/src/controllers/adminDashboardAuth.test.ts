/**
 * Authentication tests for admin dashboard endpoints
 * Verifies that all routes are properly protected by authentication middleware
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import * as adminDashboardController from './adminDashboardController';
import { requireAdminAuth } from '../middleware/adminAuth';

// Create test app with real auth middleware
const createAuthTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Use real auth middleware
  app.use('/api/admin/*', requireAdminAuth);
  
  app.get('/api/admin/mcp/stats', adminDashboardController.getMcpStats);
  app.get('/api/admin/ai/metrics', adminDashboardController.getAiMetrics);
  app.get('/api/admin/health/status', adminDashboardController.getHealthStatus);
  app.get('/api/admin/analytics/overview', adminDashboardController.getAnalyticsOverview);
  app.get('/api/admin/audit/logs', adminDashboardController.getAuditLogs);
  
  return app;
};

describe('Admin Dashboard Authentication Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = createAuthTestApp();
  });

  const protectedEndpoints = [
    '/api/admin/mcp/stats',
    '/api/admin/ai/metrics',
    '/api/admin/health/status',
    '/api/admin/analytics/overview',
    '/api/admin/audit/logs',
  ];

  describe('Unauthenticated Access', () => {
    protectedEndpoints.forEach((endpoint) => {
      it(`should reject unauthenticated requests to ${endpoint}`, async () => {
        const response = await request(app)
          .get(endpoint)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Invalid Token', () => {
    protectedEndpoints.forEach((endpoint) => {
      it(`should reject invalid tokens for ${endpoint}`, async () => {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Missing Authorization Header', () => {
    protectedEndpoints.forEach((endpoint) => {
      it(`should reject requests without Authorization header to ${endpoint}`, async () => {
        const response = await request(app)
          .get(endpoint)
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });
  });

  describe('Malformed Authorization Header', () => {
    protectedEndpoints.forEach((endpoint) => {
      it(`should reject malformed Authorization header for ${endpoint}`, async () => {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', 'InvalidFormat token')
          .expect(401);

        expect(response.body).toHaveProperty('error');
      });
    });
  });
});
