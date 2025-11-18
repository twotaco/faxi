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
import { monitoringService } from './services/monitoringService';
import { loggingService } from './services/loggingService';

const app = express();

// Monitoring and logging middleware (before other middleware)
app.use(loggingService.requestLogging());
app.use(monitoringService.requestMonitoring());

// Special middleware for Stripe webhooks (needs raw body)
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// Regular middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enhanced health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  try {
    const healthStatus = await monitoringService.getHealthStatus();
    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(healthStatus);
  } catch (error) {
    loggingService.error('Health check failed', error as Error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

// Prometheus metrics endpoint
app.get('/metrics', (req: Request, res: Response) => {
  try {
    const metrics = monitoringService.getPrometheusMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    loggingService.error('Failed to generate metrics', error as Error);
    res.status(500).send('Failed to generate metrics');
  }
});

// Monitoring dashboard endpoints
app.get('/monitoring/logs', async (req: Request, res: Response) => {
  try {
    const level = req.query.level as 'error' | 'warn' | 'info' | 'debug' | undefined;
    const limit = parseInt(req.query.limit as string) || 100;
    const userId = req.query.userId as string | undefined;
    const faxJobId = req.query.faxJobId as string | undefined;
    
    const logs = await loggingService.getRecentLogs(level, limit, { userId, faxJobId });
    res.json(logs);
  } catch (error) {
    loggingService.error('Failed to fetch logs', error as Error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

app.get('/monitoring/stats', async (req: Request, res: Response) => {
  try {
    const start = req.query.start ? new Date(req.query.start as string) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = req.query.end ? new Date(req.query.end as string) : new Date();
    
    const stats = await loggingService.getLogStatistics({ start, end });
    res.json(stats);
  } catch (error) {
    loggingService.error('Failed to fetch log statistics', error as Error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Backup and disaster recovery endpoints (admin only in production)
app.post('/admin/backup/create', async (req: Request, res: Response) => {
  try {
    const { type } = req.body;
    const { backupService } = await import('./services/backupService');
    
    let backup;
    switch (type) {
      case 'database':
        backup = await backupService.createDatabaseBackup();
        break;
      case 'full':
        backup = await backupService.createFullBackup();
        break;
      default:
        return res.status(400).json({ error: 'Invalid backup type' });
    }
    
    res.json(backup);
  } catch (error) {
    loggingService.error('Backup creation failed', error as Error);
    res.status(500).json({ error: 'Backup creation failed' });
  }
});

app.get('/admin/backup/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const { backupService } = await import('./services/backupService');
    
    const history = backupService.getBackupHistory(limit);
    res.json(history);
  } catch (error) {
    loggingService.error('Failed to fetch backup history', error as Error);
    res.status(500).json({ error: 'Failed to fetch backup history' });
  }
});

app.post('/admin/backup/test/:backupId', async (req: Request, res: Response) => {
  try {
    const { backupId } = req.params;
    const { backupService } = await import('./services/backupService');
    
    const isValid = await backupService.testBackupIntegrity(backupId);
    res.json({ backupId, valid: isValid });
  } catch (error) {
    loggingService.error('Backup integrity test failed', error as Error);
    res.status(500).json({ error: 'Backup integrity test failed' });
  }
});

app.post('/admin/disaster-recovery/execute/:planId', async (req: Request, res: Response) => {
  try {
    const { planId } = req.params;
    const { dryRun } = req.body;
    const { backupService } = await import('./services/backupService');
    
    await backupService.executeDisasterRecoveryPlan(planId, dryRun);
    res.json({ success: true, planId, dryRun });
  } catch (error) {
    loggingService.error('Disaster recovery execution failed', error as Error);
    res.status(500).json({ error: 'Disaster recovery execution failed' });
  }
});

app.get('/admin/disaster-recovery/plans', async (req: Request, res: Response) => {
  try {
    const { backupService } = await import('./services/backupService');
    
    const plans = backupService.getDisasterRecoveryPlans();
    res.json(plans);
  } catch (error) {
    loggingService.error('Failed to fetch disaster recovery plans', error as Error);
    res.status(500).json({ error: 'Failed to fetch disaster recovery plans' });
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
    loggingService.info('Starting Faxi Core System', {}, {
      environment: config.app.env,
      testMode: config.app.testMode,
      port: config.app.port,
    });

    // Test database connection
    const dbHealthy = await db.healthCheck();
    if (!dbHealthy) {
      throw new Error('Database connection failed');
    }
    loggingService.info('Database connected successfully');
    console.log('✓ Database connected');

    // Test Redis connection
    const redisHealthy = await redis.healthCheck();
    if (!redisHealthy) {
      throw new Error('Redis connection failed');
    }
    loggingService.info('Redis connected successfully');
    console.log('✓ Redis connected');

    // Test S3 connection
    const s3Healthy = await s3Storage.healthCheck();
    if (!s3Healthy) {
      loggingService.warn('S3 connection check failed (may need bucket setup)');
      console.warn('⚠ S3 connection check failed (may need bucket setup)');
    } else {
      loggingService.info('S3 connected successfully');
      console.log('✓ S3 connected');
    }

    // Start email-to-fax worker
    emailToFaxWorker.start();
    loggingService.info('Email-to-fax worker started');
    console.log('✓ Email-to-fax worker started');

    // Start fax processor worker
    await faxProcessorWorker.start();
    loggingService.info('Fax processor worker started');
    console.log('✓ Fax processor worker started');

    // Start server
    app.listen(config.app.port, () => {
      loggingService.info('Server started successfully', {}, {
        port: config.app.port,
        environment: config.app.env,
        testMode: config.app.testMode,
      });
      console.log(`✓ Server running on port ${config.app.port}`);
      console.log(`  Environment: ${config.app.env}`);
      console.log(`  Test mode: ${config.app.testMode}`);
    });
  } catch (error) {
    loggingService.error('Failed to start server', error as Error);
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  loggingService.info('SIGTERM received, shutting down gracefully...');
  console.log('SIGTERM received, shutting down gracefully...');
  
  try {
    await emailToFaxWorker.stop();
    await faxProcessorWorker.shutdown();
    await db.close();
    await redis.close();
    loggingService.info('Graceful shutdown completed');
  } catch (error) {
    loggingService.error('Error during graceful shutdown', error as Error);
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  loggingService.info('SIGINT received, shutting down gracefully...');
  console.log('SIGINT received, shutting down gracefully...');
  
  try {
    await emailToFaxWorker.stop();
    await faxProcessorWorker.shutdown();
    await db.close();
    await redis.close();
    loggingService.info('Graceful shutdown completed');
  } catch (error) {
    loggingService.error('Error during graceful shutdown', error as Error);
  }
  
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  loggingService.error('Uncaught exception', error);
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  loggingService.error('Unhandled promise rejection', reason as Error, {}, {
    promise: promise.toString(),
  });
  console.error('Unhandled promise rejection:', reason);
});

// Start the application
start();

export { app };
