import express, { Request, Response } from 'express';
import { config } from './config';
import { db } from './database/connection';
import { redis } from './queue/connection';
import { s3Storage } from './storage/s3';
import { checkQueueHealth } from './queue/faxQueue';
import { telnyxWebhookController } from './webhooks/telnyxWebhookController';
import { stripeWebhookController } from './webhooks/stripeWebhookController';
import { emailWebhookController } from './webhooks/emailWebhookController';
import { testWebhookController } from './webhooks/testWebhookController';
import { emailToFaxWorker } from './services/emailToFaxWorker';
import { faxProcessorWorker } from './services/faxProcessorWorker';

const app = express();

// Special middleware for Stripe webhooks (needs raw body)
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// Regular middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    const [dbHealthy, redisHealthy, s3Healthy, queueHealth] = await Promise.all([
      db.healthCheck(),
      redis.healthCheck(),
      s3Storage.healthCheck(),
      checkQueueHealth(),
    ]);

    const healthy = dbHealthy && redisHealthy && s3Healthy && 
                    queueHealth.faxProcessing && queueHealth.emailToFax;

    const status = {
      status: healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? 'up' : 'down',
        redis: redisHealthy ? 'up' : 'down',
        s3: s3Healthy ? 'up' : 'down',
        faxQueue: queueHealth.faxProcessing ? 'up' : 'down',
        emailQueue: queueHealth.emailToFax ? 'up' : 'down',
      },
    };

    res.status(healthy ? 200 : 503).json(status);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'Faxi Core System',
    version: '1.0.0',
    status: 'running',
  });
});

// Webhook endpoints
app.post('/webhooks/telnyx/fax/received', (req: Request, res: Response) => {
  telnyxWebhookController.handleFaxReceived(req, res);
});

app.post('/webhooks/stripe', (req: Request, res: Response) => {
  stripeWebhookController.handleWebhook(req, res);
});

app.post('/webhooks/email/received', (req: Request, res: Response) => {
  emailWebhookController.handleEmailReceived(req, res);
});

// Test endpoints (only available in test mode)
if (config.app.testMode) {
  app.post('/test/fax/receive', (req: Request, res: Response) => {
    testWebhookController.handleTestFaxReceive(req, res);
  });

  app.get('/test/fax/media/:fax_id', (req: Request, res: Response) => {
    testWebhookController.serveTestFaxMedia(req, res);
  });

  app.get('/test/fax/status/:fax_id', (req: Request, res: Response) => {
    testWebhookController.getTestFaxStatus(req, res);
  });

  app.get('/test/fax/list', (req: Request, res: Response) => {
    testWebhookController.listTestFaxes(req, res);
  });

  app.delete('/test/fax/clear', (req: Request, res: Response) => {
    testWebhookController.clearTestData(req, res);
  });

  app.get('/test/fax/responses', (req: Request, res: Response) => {
    testWebhookController.getMockSentFaxes(req, res);
  });

  app.get('/test/fax/download/:fax_id', (req: Request, res: Response) => {
    testWebhookController.downloadMockFax(req, res);
  });

  app.get('/test/fax/stats', (req: Request, res: Response) => {
    testWebhookController.getMockFaxStats(req, res);
  });

  app.get('/test/fax/fixtures', (req: Request, res: Response) => {
    testWebhookController.listTestFixtures(req, res);
  });

  app.get('/test/fax/fixtures/:filename', (req: Request, res: Response) => {
    testWebhookController.serveTestFixture(req, res);
  });

  app.post('/test/fax/fixtures/generate', (req: Request, res: Response) => {
    testWebhookController.generateTestFixtures(req, res);
  });

  // Serve test UI
  app.get('/test', (req: Request, res: Response) => {
    res.sendFile('test/testUI.html', { root: __dirname });
  });
}

// Start server
async function start() {
  try {
    // Test database connection
    const dbHealthy = await db.healthCheck();
    if (!dbHealthy) {
      throw new Error('Database connection failed');
    }
    console.log('✓ Database connected');

    // Test Redis connection
    const redisHealthy = await redis.healthCheck();
    if (!redisHealthy) {
      throw new Error('Redis connection failed');
    }
    console.log('✓ Redis connected');

    // Test S3 connection
    const s3Healthy = await s3Storage.healthCheck();
    if (!s3Healthy) {
      console.warn('⚠ S3 connection check failed (may need bucket setup)');
    } else {
      console.log('✓ S3 connected');
    }

    // Start email-to-fax worker
    emailToFaxWorker.start();
    console.log('✓ Email-to-fax worker started');

    // Start fax processor worker
    await faxProcessorWorker.start();
    console.log('✓ Fax processor worker started');

    // Start server
    app.listen(config.app.port, () => {
      console.log(`✓ Server running on port ${config.app.port}`);
      console.log(`  Environment: ${config.app.env}`);
      console.log(`  Test mode: ${config.app.testMode}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await emailToFaxWorker.stop();
  await faxProcessorWorker.shutdown();
  await db.close();
  await redis.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await emailToFaxWorker.stop();
  await faxProcessorWorker.shutdown();
  await db.close();
  await redis.close();
  process.exit(0);
});

// Start the application
start();

export { app };
