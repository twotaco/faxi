/**
 * Unit tests for demo and metrics endpoints
 * Feature: hackathon-winning-features
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import cors from 'cors';
import { demoController } from '../../webhooks/demoController';
import { metricsController } from '../../webhooks/metricsController';

describe('Demo and Metrics Endpoints', () => {
  let app: Express;

  beforeAll(() => {
    // Create test app
    app = express();
    
    app.use(cors({
      origin: ['http://localhost:4003', 'http://localhost:4001'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    }));

    app.use(express.json());
    app.use('/api/demo', demoController);
    app.use('/api/metrics', metricsController);
  });

  describe('GET /api/demo/fixtures', () => {
    it('should return list of fixtures', async () => {
      const response = await request(app)
        .get('/api/demo/fixtures')
        .expect(200);

      expect(response.body).toHaveProperty('fixtures');
      expect(Array.isArray(response.body.fixtures)).toBe(true);
    });

    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/demo/fixtures')
        .set('Origin', 'http://localhost:4003');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('POST /api/demo/process', () => {
    it('should reject request without fixtureId or imageData', async () => {
      const response = await request(app)
        .post('/api/demo/process')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid fixture ID', async () => {
      const response = await request(app)
        .post('/api/demo/process')
        .send({ fixtureId: 'nonexistent_fixture' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should include CORS headers', async () => {
      const response = await request(app)
        .post('/api/demo/process')
        .set('Origin', 'http://localhost:4003')
        .send({ fixtureId: 'test' });

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('GET /api/metrics/accuracy', () => {
    it('should return accuracy metrics structure', async () => {
      const response = await request(app)
        .get('/api/metrics/accuracy')
        .expect(200);

      expect(response.body).toHaveProperty('overall');
      expect(response.body).toHaveProperty('byCategory');
      expect(response.body).toHaveProperty('byUseCase');
      expect(response.body).toHaveProperty('trend');
    });

    it('should return empty state when no data available', async () => {
      const response = await request(app)
        .get('/api/metrics/accuracy')
        .expect(200);

      // Should have structure even with no data
      expect(response.body.byCategory).toHaveProperty('ocr');
      expect(response.body.byCategory).toHaveProperty('annotation');
      expect(response.body.byCategory).toHaveProperty('intent');
    });

    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/metrics/accuracy')
        .set('Origin', 'http://localhost:4003');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('GET /api/metrics/processing-stats', () => {
    it('should return processing stats structure', async () => {
      const response = await request(app)
        .get('/api/metrics/processing-stats')
        .expect(200);

      expect(response.body).toHaveProperty('averageTime');
      expect(response.body).toHaveProperty('successRate');
      expect(response.body).toHaveProperty('totalProcessed');
      expect(response.body).toHaveProperty('confidenceDistribution');
      expect(response.body).toHaveProperty('byUseCase');
    });

    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/metrics/processing-stats')
        .set('Origin', 'http://localhost:4003');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('GET /api/metrics/summary', () => {
    it('should return combined summary', async () => {
      const response = await request(app)
        .get('/api/metrics/summary')
        .expect(200);

      expect(response.body).toHaveProperty('accuracy');
      expect(response.body).toHaveProperty('processing');
      expect(response.body.accuracy).toHaveProperty('overall');
      expect(response.body.processing).toHaveProperty('averageTime');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on demo endpoints', async () => {
      // Make 11 requests (limit is 10 per 15 minutes)
      const requests = Array.from({ length: 11 }, () =>
        request(app).get('/api/demo/fixtures')
      );

      const responses = await Promise.all(requests);
      
      // Last request should be rate limited
      const lastResponse = responses[responses.length - 1];
      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body).toHaveProperty('error');
      expect(lastResponse.body.error).toContain('Too many requests');
    }, 10000); // Increase timeout for this test
  });
});
