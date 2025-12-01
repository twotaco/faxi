/**
 * Property-based tests for CORS header presence
 * Feature: hackathon-winning-features
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import request from 'supertest';
import express, { Express } from 'express';
import cors from 'cors';
import { demoController } from '../../webhooks/demoController';
import { metricsController } from '../../webhooks/metricsController';

describe('**Feature: hackathon-winning-features, Property 5: CORS header presence**', () => {
  let app: Express;

  beforeAll(() => {
    // Create test app with CORS configuration
    app = express();
    
    // Apply CORS middleware (matching production config)
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

  /**
   * Property 5: CORS header presence
   * For any API response to the marketing website, it should include 
   * appropriate CORS headers allowing cross-origin requests
   * Validates: Requirements 10.5
   */
  it('should include CORS headers for any demo API request', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          '/api/demo/fixtures',
          '/api/metrics/accuracy',
          '/api/metrics/processing-stats',
          '/api/metrics/summary'
        ),
        async (endpoint) => {
          const response = await request(app)
            .get(endpoint)
            .set('Origin', 'http://localhost:4003');

          // Verify CORS headers are present
          expect(response.headers).toHaveProperty('access-control-allow-origin');
          
          // Verify origin is allowed
          const allowedOrigin = response.headers['access-control-allow-origin'];
          expect(['http://localhost:4003', 'http://localhost:4001', '*']).toContain(allowedOrigin);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include CORS headers for OPTIONS preflight requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          '/api/demo/fixtures',
          '/api/demo/process',
          '/api/metrics/accuracy',
          '/api/metrics/processing-stats'
        ),
        async (endpoint) => {
          const response = await request(app)
            .options(endpoint)
            .set('Origin', 'http://localhost:4003')
            .set('Access-Control-Request-Method', 'GET');

          // Verify CORS preflight headers
          expect(response.headers).toHaveProperty('access-control-allow-origin');
          expect(response.headers).toHaveProperty('access-control-allow-methods');
          
          // Verify methods are allowed
          const allowedMethods = response.headers['access-control-allow-methods'];
          if (allowedMethods) {
            expect(allowedMethods).toMatch(/GET/);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should allow credentials in CORS headers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          '/api/demo/fixtures',
          '/api/metrics/accuracy'
        ),
        async (endpoint) => {
          const response = await request(app)
            .get(endpoint)
            .set('Origin', 'http://localhost:4003');

          // Verify credentials are allowed
          const allowCredentials = response.headers['access-control-allow-credentials'];
          expect(allowCredentials).toBe('true');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include CORS headers for POST requests', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          fixtureId: fc.constantFrom('email_request', 'shopping_request', 'ai_chat_request')
        }),
        async ({ fixtureId }) => {
          const response = await request(app)
            .post('/api/demo/process')
            .set('Origin', 'http://localhost:4003')
            .send({ fixtureId });

          // Verify CORS headers are present even for POST
          expect(response.headers).toHaveProperty('access-control-allow-origin');
          
          const allowedOrigin = response.headers['access-control-allow-origin'];
          expect(['http://localhost:4003', 'http://localhost:4001', '*']).toContain(allowedOrigin);
        }
      ),
      { numRuns: 50 } // Fewer runs for POST requests
    );
  });

  it('should include proper CORS headers for different origins', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'http://localhost:4003',
          'http://localhost:4001'
        ),
        async (origin) => {
          const response = await request(app)
            .get('/api/demo/fixtures')
            .set('Origin', origin);

          // Verify CORS headers match the origin
          expect(response.headers).toHaveProperty('access-control-allow-origin');
          
          const allowedOrigin = response.headers['access-control-allow-origin'];
          // Should either match the origin or be wildcard
          expect([origin, '*']).toContain(allowedOrigin);
        }
      ),
      { numRuns: 100 }
    );
  });
});
