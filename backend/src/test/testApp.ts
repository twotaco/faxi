import express, { Express } from 'express';
import { testWebhookController } from '../webhooks/testWebhookController';

/**
 * Create a test Express app instance for integration testing
 */
export async function createTestApp(): Promise<Express> {
  const app = express();

  // Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Test mode routes
  if (process.env.TEST_MODE === 'true') {
    // Test fax endpoints
    app.post('/test/fax/receive', testWebhookController.handleTestFaxReceive.bind(testWebhookController));
    app.get('/test/fax/media/:fax_id', testWebhookController.serveTestFaxMedia.bind(testWebhookController));
    app.get('/test/fax/status/:fax_id', testWebhookController.getTestFaxStatus.bind(testWebhookController));
    app.get('/test/fax/list', testWebhookController.listTestFaxes.bind(testWebhookController));
    app.get('/test/fax/responses', testWebhookController.getMockSentFaxes.bind(testWebhookController));
    app.get('/test/fax/download/:fax_id', testWebhookController.downloadMockFax.bind(testWebhookController));
    app.get('/test/fax/stats', testWebhookController.getMockFaxStats.bind(testWebhookController));
    app.delete('/test/fax/clear', testWebhookController.clearTestData.bind(testWebhookController));

    // Test fixture endpoints
    app.get('/test/fax/fixtures', testWebhookController.listTestFixtures.bind(testWebhookController));
    app.get('/test/fax/fixtures/:filename', testWebhookController.serveTestFixture.bind(testWebhookController));
    app.post('/test/fax/fixtures/generate', testWebhookController.generateTestFixtures.bind(testWebhookController));

    // Test UI
    app.get('/test', (req, res) => {
      res.sendFile('testUI.html', { root: 'src/test' });
    });
  }

  // Production webhook endpoints (for testing webhook processing)
  try {
    const { telnyxWebhookController } = await import('../webhooks/telnyxWebhookController');
    const { emailWebhookController } = await import('../webhooks/emailWebhookController');
    const { stripeWebhookController } = await import('../webhooks/stripeWebhookController');

    if (telnyxWebhookController?.handleWebhook) {
      // Single endpoint for all Telnyx fax events
      app.post('/webhooks/telnyx/fax', telnyxWebhookController.handleWebhook.bind(telnyxWebhookController));
      // Legacy endpoint for backward compatibility
      app.post('/webhooks/telnyx/fax/received', telnyxWebhookController.handleFaxReceived.bind(telnyxWebhookController));
    }
    if (emailWebhookController?.handleEmailReceived) {
      app.post('/webhooks/email/received', emailWebhookController.handleEmailReceived.bind(emailWebhookController));
    }
    if (stripeWebhookController?.handleWebhook) {
      app.post('/webhooks/stripe', stripeWebhookController.handleWebhook.bind(stripeWebhookController));
    }
  } catch (error) {
    console.warn('Some webhook controllers not available in test mode:', (error as Error).message);
    
    // Provide mock webhook endpoints for testing
    app.post('/webhooks/telnyx/fax', (req, res) => {
      res.json({ success: true, message: 'Mock Telnyx webhook (single endpoint)' });
    });
    app.post('/webhooks/telnyx/fax/received', (req, res) => {
      res.json({ success: true, message: 'Mock Telnyx webhook (legacy endpoint)' });
    });
    app.post('/webhooks/email/received', (req, res) => {
      res.json({ success: true, message: 'Mock email webhook' });
    });
    app.post('/webhooks/stripe', (req, res) => {
      res.json({ success: true, message: 'Mock Stripe webhook' });
    });
  }

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', testMode: process.env.TEST_MODE === 'true' });
  });

  // Error handling
  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Test app error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      testMode: true,
    });
  });

  return app;
}