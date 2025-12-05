import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../index';
import { db } from '../database/connection';
import { adminAuthService } from '../services/adminAuthService';

describe('Admin Dashboard Controller', () => {
  let authToken: string;
  let testAdminId: string;

  beforeAll(async () => {
    // Create a test admin user
    const result = await db.query(
      `INSERT INTO admin_users (email, password_hash, name, role, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        'test-dashboard@faxi.test',
        await adminAuthService.hashPassword('testpassword123'),
        'Test Dashboard Admin',
        'admin',
        true,
      ]
    );
    testAdminId = result.rows[0].id;

    // Generate auth token
    const { accessToken } = await adminAuthService.generateTokens({
      id: testAdminId,
      email: 'test-dashboard@faxi.test',
      name: 'Test Dashboard Admin',
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
      passwordHash: '',
    });
    authToken = accessToken;
  });

  afterAll(async () => {
    // Clean up test admin user
    await db.query('DELETE FROM admin_users WHERE id = $1', [testAdminId]);
  });

  describe('GET /api/admin/dashboard/mcp/stats', () => {
    it('should return MCP server statistics', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/mcp/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('servers');
      expect(response.body).toHaveProperty('recentErrors');
      expect(response.body).toHaveProperty('externalAPIs');
      expect(Array.isArray(response.body.servers)).toBe(true);
      expect(Array.isArray(response.body.recentErrors)).toBe(true);
      expect(Array.isArray(response.body.externalAPIs)).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/admin/dashboard/mcp/stats')
        .expect(401);
    });
  });

  describe('GET /api/admin/dashboard/ai/metrics', () => {
    it('should return AI processing metrics', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/ai/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('aggregate');
      expect(response.body).toHaveProperty('recentProcessing');
      expect(response.body.aggregate).toHaveProperty('successRate');
      expect(response.body.aggregate).toHaveProperty('avgAccuracy');
      expect(response.body.aggregate).toHaveProperty('avgConfidence');
      expect(response.body.aggregate).toHaveProperty('avgProcessingTime');
      expect(Array.isArray(response.body.recentProcessing)).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/admin/dashboard/ai/metrics')
        .expect(401);
    });
  });

  describe('GET /api/admin/dashboard/health/status', () => {
    it('should return system health status', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/health/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('infrastructure');
      expect(response.body).toHaveProperty('resources');
      expect(response.body).toHaveProperty('queues');
      expect(response.body).toHaveProperty('recentErrors');
      expect(response.body.infrastructure).toHaveProperty('database');
      expect(response.body.infrastructure).toHaveProperty('redis');
      expect(response.body.infrastructure).toHaveProperty('s3');
      expect(Array.isArray(response.body.recentErrors)).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/admin/dashboard/health/status')
        .expect(401);
    });
  });

  describe('GET /api/admin/dashboard/analytics/overview', () => {
    it('should return analytics overview', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/analytics/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('faxJobs');
      expect(response.body).toHaveProperty('orders');
      expect(response.body).toHaveProperty('processing');
      expect(response.body.users).toHaveProperty('total');
      expect(response.body.faxJobs).toHaveProperty('total');
      expect(response.body.faxJobs).toHaveProperty('last24Hours');
      expect(Array.isArray(response.body.faxJobs.perDay)).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/admin/dashboard/analytics/overview')
        .expect(401);
    });
  });

  describe('GET /api/admin/dashboard/audit/logs', () => {
    it('should return audit logs', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/audit/logs')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('logs');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('eventTypes');
      expect(Array.isArray(response.body.logs)).toBe(true);
      expect(Array.isArray(response.body.eventTypes)).toBe(true);
      expect(typeof response.body.total).toBe('number');
    });

    it('should support filtering by event type', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard/audit/logs?eventType=admin.login_success')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('logs');
      expect(Array.isArray(response.body.logs)).toBe(true);
    });

    it('should support date range filtering', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endDate = new Date().toISOString();

      const response = await request(app)
        .get(`/api/admin/dashboard/audit/logs?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('logs');
      expect(Array.isArray(response.body.logs)).toBe(true);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/admin/dashboard/audit/logs')
        .expect(401);
    });
  });
});
