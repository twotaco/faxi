import express, { Request, Response } from 'express';
import { config } from './config';
import { db } from './database/connection';
import { redis } from './queue/connection';
import { s3Storage } from './storage/s3';
import { checkQueueHealth } from './queue/faxQueue';
import { telnyxWebhookController } from './webhooks/telnyxWebhookController';

const app = express();

// Middleware
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
  await db.close();
  await redis.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await db.close();
  await redis.close();
  process.exit(0);
});

// Start the application
start();

export { app };
