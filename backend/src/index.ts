import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
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
import { mockFaxSender } from './services/mockFaxSender';

const app = express();

// CORS configuration for admin dashboard and marketing website
const allowedOrigins = config.app.env === 'production' 
  ? [
      'https://admin.faxi.jp',
      'https://app.faxi.jp',
      'https://faxi.jp',
      'https://www.faxi.jp',
      // Add Vercel deployment URLs
      process.env.MARKETING_SITE_URL || 'https://faxi-marketing.vercel.app',
      // Allow preview deployments
      ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : [])
    ].filter(Boolean)
  : ['http://localhost:4001', 'http://localhost:4002'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (config.app.env !== 'production' && origin.includes('localhost')) {
      // Allow all localhost origins in development
      callback(null, true);
    } else if (config.app.env === 'production' && origin.includes('.vercel.app')) {
      // Allow Vercel preview deployments in production
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}));

// Monitoring and logging middleware (before other middleware)
app.use(loggingService.requestLogging());
app.use(monitoringService.requestMonitoring());

// Special middleware for Stripe webhooks (needs raw body)
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// Regular middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files (favicon, etc.)
app.use('/public', express.static(path.join(__dirname, '../public')));

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

// Admin Authentication Endpoints
import { adminAuthService } from './services/adminAuthService';
import { adminUserRepository } from './repositories/adminUserRepository';
import { loginRateLimiter } from './middleware/rateLimiter';
import { auditLogService } from './services/auditLogService';

// Admin login endpoint (rate limiting disabled for development)
app.post('/admin/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required',
      });
    }

    // Find user with password hash
    const user = await adminUserRepository.findByEmailWithPassword(email);

    if (!user) {
      // Don't reveal if user exists
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid email or password',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      await auditLogService.log({
        eventType: 'admin.login_failed',
        eventData: {
          email,
          reason: 'account_inactive',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString(),
        },
      });

      return res.status(403).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated. Please contact an administrator.',
      });
    }

    // Verify password
    const isValidPassword = await adminAuthService.verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      await auditLogService.log({
        eventType: 'admin.login_failed',
        eventData: {
          email,
          reason: 'invalid_password',
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          timestamp: new Date().toISOString(),
        },
      });

      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid email or password',
      });
    }

    // Generate tokens
    const { accessToken, refreshTokenId, expiresAt } = await adminAuthService.generateTokens(user);

    // Store refresh token in database
    await adminUserRepository.createRefreshToken(user.id, refreshTokenId, expiresAt);

    // Update last login time
    await adminUserRepository.update(user.id, { lastLoginAt: new Date() });

    // Log successful login
    await auditLogService.log({
      userId: user.id,
      eventType: 'admin.login_success',
      eventData: {
        email: user.email,
        role: user.role,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
      },
    });

    // Set refresh token as httpOnly cookie
    res.cookie('admin_refresh_token', refreshTokenId, {
      httpOnly: true,
      secure: config.app.env === 'production',
      sameSite: 'lax', // Changed from 'strict' to 'lax' for cross-origin
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/', // Changed from '/admin/auth' to '/' so cookie is sent everywhere
    });

    // Return access token and user info
    res.json({
      accessToken,
      expiresIn: 60 * 60, // 1 hour in seconds
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    loggingService.error('Admin login error', error as Error);
    res.status(500).json({
      error: 'Login failed',
      message: 'An error occurred during login. Please try again.',
    });
  }
});

// Admin logout endpoint
app.post('/admin/auth/logout', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.admin_refresh_token;

    if (refreshToken) {
      // Revoke the refresh token
      await adminUserRepository.revokeRefreshToken(refreshToken);

      // Log logout
      const token = await adminUserRepository.findRefreshToken(refreshToken);
      if (token) {
        await auditLogService.log({
          userId: token.adminUserId,
          eventType: 'admin.logout',
          eventData: {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Clear the cookie
    res.clearCookie('admin_refresh_token', {
      httpOnly: true,
      secure: config.app.env === 'production',
      sameSite: 'lax',
      path: '/',
    });

    res.json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    loggingService.error('Admin logout error', error as Error);
    res.status(500).json({
      error: 'Logout failed',
      message: 'An error occurred during logout.',
    });
  }
});

// Admin refresh token endpoint
app.post('/admin/auth/refresh', async (req: Request, res: Response) => {
  try {
    const refreshTokenId = req.cookies.admin_refresh_token;

    if (!refreshTokenId) {
      return res.status(401).json({
        error: 'No refresh token',
        message: 'Refresh token not found. Please login again.',
      });
    }

    // Find and validate refresh token
    const refreshToken = await adminUserRepository.findRefreshToken(refreshTokenId);

    if (!refreshToken) {
      res.clearCookie('admin_refresh_token', {
        httpOnly: true,
        secure: config.app.env === 'production',
        sameSite: 'lax',
        path: '/',
      });

      return res.status(401).json({
        error: 'Invalid refresh token',
        message: 'Refresh token is invalid or expired. Please login again.',
      });
    }

    // Get user
    const user = await adminUserRepository.findById(refreshToken.adminUserId);

    if (!user || !user.isActive) {
      await adminUserRepository.revokeRefreshToken(refreshTokenId);
      res.clearCookie('admin_refresh_token', {
        httpOnly: true,
        secure: config.app.env === 'production',
        sameSite: 'lax',
        path: '/',
      });

      return res.status(403).json({
        error: 'Account inactive',
        message: 'Your account has been deactivated.',
      });
    }

    // Revoke old refresh token
    await adminUserRepository.revokeRefreshToken(refreshTokenId);

    // Generate new tokens (token rotation)
    const { accessToken, refreshTokenId: newRefreshTokenId, expiresAt } = 
      await adminAuthService.generateTokens(user);

    // Store new refresh token
    await adminUserRepository.createRefreshToken(user.id, newRefreshTokenId, expiresAt);

    // Set new refresh token cookie
    res.cookie('admin_refresh_token', newRefreshTokenId, {
      httpOnly: true,
      secure: config.app.env === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    });

    // Return new access token
    res.json({
      accessToken,
      expiresIn: 60 * 60, // 1 hour in seconds
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    loggingService.error('Admin token refresh error', error as Error);
    res.status(500).json({
      error: 'Token refresh failed',
      message: 'An error occurred while refreshing token.',
    });
  }
});

// Admin Dashboard Endpoints
import { requireAdminAuth, requirePermission, hasPermission } from './middleware/adminAuth';
import { faxJobRepository } from './repositories/faxJobRepository';

// Dashboard metrics endpoint
app.get('/admin/dashboard/metrics', requireAdminAuth, requirePermission('dashboard:view'), async (req: Request, res: Response) => {
  try {
    // Get system health status from monitoring service
    const healthStatus = await monitoringService.getHealthStatus();

    // Get active jobs count
    const activeJobsResult = await db.query(
      `SELECT COUNT(*) as count FROM fax_jobs WHERE status IN ('pending', 'processing')`
    );
    const activeJobsCount = parseInt(activeJobsResult.rows[0].count, 10);

    // Get recent jobs (last 10)
    const recentJobsResult = await db.query(
      `SELECT id, reference_id as "referenceId", user_id as "userId", direction, 
              from_number as "fromNumber", to_number as "toNumber", status, 
              created_at as "createdAt", updated_at as "updatedAt"
       FROM fax_jobs 
       ORDER BY created_at DESC 
       LIMIT 10`
    );

    // Get error rate from audit logs (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const errorLogsResult = await db.query(
      `SELECT COUNT(*) as count FROM audit_logs 
       WHERE event_type LIKE '%.error' OR event_type LIKE '%.failed' 
       AND created_at > $1`,
      [oneHourAgo]
    );
    const errorCount = parseInt(errorLogsResult.rows[0].count, 10);

    // Get total requests in last hour (from monitoring service metrics)
    const totalLogsResult = await db.query(
      `SELECT COUNT(*) as count FROM audit_logs WHERE created_at > $1`,
      [oneHourAgo]
    );
    const totalCount = parseInt(totalLogsResult.rows[0].count, 10);
    const errorRate = totalCount > 0 ? (errorCount / totalCount) * 100 : 0;

    // Get processing time stats (last 100 completed jobs)
    const processingTimeResult = await db.query(
      `SELECT 
         EXTRACT(EPOCH FROM (completed_at - created_at)) as duration
       FROM fax_jobs 
       WHERE status = 'completed' AND completed_at IS NOT NULL
       ORDER BY completed_at DESC 
       LIMIT 100`
    );

    const durations = processingTimeResult.rows.map(row => parseFloat(row.duration));
    const avgProcessingTime = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0;

    // Calculate percentiles
    const sortedDurations = [...durations].sort((a, b) => a - b);
    const p50 = sortedDurations[Math.floor(sortedDurations.length * 0.5)] || 0;
    const p95 = sortedDurations[Math.floor(sortedDurations.length * 0.95)] || 0;
    const p99 = sortedDurations[Math.floor(sortedDurations.length * 0.99)] || 0;

    // Compile dashboard metrics
    const metrics = {
      timestamp: new Date().toISOString(),
      health: {
        status: healthStatus.status,
        services: healthStatus.services,
      },
      system: {
        uptime: healthStatus.metrics.uptime,
        memoryUsage: {
          used: healthStatus.metrics.memoryUsage.heapUsed,
          total: healthStatus.metrics.memoryUsage.heapTotal,
          percentage: (healthStatus.metrics.memoryUsage.heapUsed / healthStatus.metrics.memoryUsage.heapTotal) * 100,
        },
        activeConnections: healthStatus.metrics.activeConnections,
      },
      jobs: {
        active: activeJobsCount,
        recent: recentJobsResult.rows,
      },
      queue: {
        faxProcessing: healthStatus.metrics.queueSizes.faxProcessing,
        emailToFax: healthStatus.metrics.queueSizes.emailToFax,
        total: healthStatus.metrics.queueSizes.faxProcessing + healthStatus.metrics.queueSizes.emailToFax,
      },
      errors: {
        count: errorCount,
        rate: errorRate,
        period: '1h',
      },
      performance: {
        avgProcessingTime,
        percentiles: {
          p50,
          p95,
          p99,
        },
        sampleSize: durations.length,
      },
    };

    res.json(metrics);
  } catch (error) {
    loggingService.error('Failed to fetch dashboard metrics', error as Error);
    res.status(500).json({
      error: 'Failed to fetch metrics',
      message: 'An error occurred while fetching dashboard metrics',
    });
  }
});

// Dashboard real-time stream (SSE) - Custom auth for EventSource
app.get('/admin/dashboard/stream', async (req: Request, res: Response) => {
  // EventSource can't send custom headers, so check query param or cookie
  let token = req.query.token as string;
  
  // If no query token, try to get from Authorization header
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }
  
  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No authentication token provided',
    });
  }
  
  // Verify token
  const payload = adminAuthService.verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
  
  // Check permission
  if (!hasPermission(payload.role, 'dashboard:view')) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Insufficient permissions',
    });
  }
  
  req.adminUser = {
    id: payload.userId,
    email: payload.email,
    role: payload.role,
  };
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

  // Function to send metrics
  const sendMetrics = async () => {
    try {
      const healthStatus = await monitoringService.getHealthStatus();

      // Get active jobs count
      const activeJobsResult = await db.query(
        `SELECT COUNT(*) as count FROM fax_jobs WHERE status IN ('pending', 'processing')`
      );
      const activeJobsCount = parseInt(activeJobsResult.rows[0].count, 10);

      // Get error rate
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const errorLogsResult = await db.query(
        `SELECT COUNT(*) as count FROM audit_logs 
         WHERE (event_type LIKE '%.error' OR event_type LIKE '%.failed') 
         AND created_at > $1`,
        [oneHourAgo]
      );
      const errorCount = parseInt(errorLogsResult.rows[0].count, 10);

      const metrics = {
        type: 'metrics',
        timestamp: new Date().toISOString(),
        data: {
          health: healthStatus.status,
          services: healthStatus.services,
          activeJobs: activeJobsCount,
          queueSize: healthStatus.metrics.queueSizes.faxProcessing + healthStatus.metrics.queueSizes.emailToFax,
          errorCount,
          memoryUsage: Math.round((healthStatus.metrics.memoryUsage.heapUsed / healthStatus.metrics.memoryUsage.heapTotal) * 100),
        },
      };

      res.write(`data: ${JSON.stringify(metrics)}\n\n`);
    } catch (error) {
      console.error('Error sending metrics:', error);
    }
  };

  // Send metrics every 5 seconds
  const metricsInterval = setInterval(sendMetrics, 5000);

  // Send initial metrics immediately
  await sendMetrics();

  // Listen for alerts from alerting service
  const alertListener = (alert: any) => {
    try {
      const alertEvent = {
        type: 'alert',
        timestamp: new Date().toISOString(),
        data: alert,
      };
      res.write(`data: ${JSON.stringify(alertEvent)}\n\n`);
    } catch (error) {
      console.error('Error sending alert:', error);
    }
  };

  // Note: In a production system, you'd subscribe to an event emitter
  // For now, we'll just send metrics periodically

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(metricsInterval);
    res.end();
  });
});

// Fax job management endpoints

// List fax jobs with filtering and pagination
app.get('/admin/jobs', requireAdminAuth, requirePermission('jobs:view'), async (req: Request, res: Response) => {
  try {
    const {
      status,
      user,
      intent,
      from,
      to,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    // Build query
    const conditions: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (status) {
      conditions.push(`status = $${paramCount++}`);
      params.push(status);
    }

    if (user) {
      conditions.push(`user_id = $${paramCount++}`);
      params.push(user);
    }

    if (intent) {
      conditions.push(`interpretation_result->>'intent' = $${paramCount++}`);
      params.push(intent);
    }

    if (from) {
      conditions.push(`created_at >= $${paramCount++}`);
      params.push(new Date(from as string));
    }

    if (to) {
      conditions.push(`created_at <= $${paramCount++}`);
      params.push(new Date(to as string));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as count FROM fax_jobs ${whereClause}`,
      params
    );
    const totalCount = parseInt(countResult.rows[0].count, 10);

    // Get jobs
    params.push(limitNum, offset);
    const jobsResult = await db.query(
      `SELECT 
         id, fax_id as "faxId", reference_id as "referenceId", 
         user_id as "userId", direction, from_number as "fromNumber", 
         to_number as "toNumber", status, page_count as "pageCount",
         media_url as "mediaUrl", storage_key as "storageKey",
         interpretation_result as "interpretationResult",
         error_message as "errorMessage",
         created_at as "createdAt", updated_at as "updatedAt",
         completed_at as "completedAt"
       FROM fax_jobs 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramCount++} OFFSET $${paramCount++}`,
      params
    );

    res.json({
      jobs: jobsResult.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error) {
    loggingService.error('Failed to fetch fax jobs', error as Error);
    res.status(500).json({
      error: 'Failed to fetch jobs',
      message: 'An error occurred while fetching fax jobs',
    });
  }
});

// Get single fax job details
app.get('/admin/jobs/:id', requireAdminAuth, requirePermission('jobs:view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const job = await faxJobRepository.findById(id);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Fax job with ID ${id} not found`,
      });
    }

    // Get audit logs for this job
    const auditLogs = await db.query(
      `SELECT id, user_id as "userId", event_type as "eventType", 
              event_data as "eventData", created_at as "createdAt"
       FROM audit_logs 
       WHERE fax_job_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [id]
    );

    // Log the view action
    await auditLogService.log({
      userId: req.adminUser?.id,
      faxJobId: id,
      eventType: 'admin.job_viewed',
      eventData: {
        adminEmail: req.adminUser?.email,
        jobId: id,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({
      job,
      auditLogs: auditLogs.rows,
    });
  } catch (error) {
    loggingService.error('Failed to fetch fax job details', error as Error);
    res.status(500).json({
      error: 'Failed to fetch job',
      message: 'An error occurred while fetching fax job details',
    });
  }
});

// Retry failed fax job
app.post('/admin/jobs/:id/retry', requireAdminAuth, requirePermission('jobs:retry'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const job = await faxJobRepository.findById(id);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Fax job with ID ${id} not found`,
      });
    }

    if (job.status !== 'failed') {
      return res.status(400).json({
        error: 'Invalid status',
        message: 'Only failed jobs can be retried',
        currentStatus: job.status,
      });
    }

    // Update job status to pending
    await faxJobRepository.update(id, {
      status: 'pending',
      errorMessage: undefined,
    });

    // Re-enqueue the job
    const { faxProcessingQueue } = await import('./queue/faxQueue');
    await faxProcessingQueue.add('process-fax', {
      faxJobId: id,
      faxId: job.faxId,
      userId: job.userId,
    });

    // Log the retry action
    await auditLogService.log({
      userId: req.adminUser?.id,
      faxJobId: id,
      eventType: 'admin.job_retried',
      eventData: {
        adminEmail: req.adminUser?.email,
        adminRole: req.adminUser?.role,
        jobId: id,
        previousStatus: 'failed',
        timestamp: new Date().toISOString(),
      },
    });

    res.json({
      message: 'Job retry initiated',
      jobId: id,
      status: 'pending',
    });
  } catch (error) {
    loggingService.error('Failed to retry fax job', error as Error);
    res.status(500).json({
      error: 'Failed to retry job',
      message: 'An error occurred while retrying the fax job',
    });
  }
});

// Cancel pending/processing fax job
app.post('/admin/jobs/:id/cancel', requireAdminAuth, requirePermission('jobs:cancel'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const job = await faxJobRepository.findById(id);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Fax job with ID ${id} not found`,
      });
    }

    if (!['pending', 'processing'].includes(job.status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: 'Only pending or processing jobs can be cancelled',
        currentStatus: job.status,
      });
    }

    // Update job status to failed with cancellation message
    await faxJobRepository.update(id, {
      status: 'failed',
      errorMessage: `Cancelled by admin: ${req.adminUser?.email}`,
      completedAt: new Date(),
    });

    // Log the cancel action
    await auditLogService.log({
      userId: req.adminUser?.id,
      faxJobId: id,
      eventType: 'admin.job_cancelled',
      eventData: {
        adminEmail: req.adminUser?.email,
        adminRole: req.adminUser?.role,
        jobId: id,
        previousStatus: job.status,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({
      message: 'Job cancelled successfully',
      jobId: id,
      status: 'failed',
    });
  } catch (error) {
    loggingService.error('Failed to cancel fax job', error as Error);
    res.status(500).json({
      error: 'Failed to cancel job',
      message: 'An error occurred while cancelling the fax job',
    });
  }
});

// Get fax image (inbound or response)
app.get('/admin/jobs/:id/fax-image', requireAdminAuth, requirePermission('jobs:view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type = 'inbound' } = req.query; // 'inbound' or 'response'

    const job = await faxJobRepository.findById(id);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Fax job with ID ${id} not found`,
      });
    }

    let s3Key: string;
    
    if (type === 'response' && job.actionResults?.responseFaxId) {
      // Get response fax image
      s3Key = s3Storage.generateFaxKey(job.actionResults.responseFaxId, 'pdf');
    } else {
      // Get inbound fax image
      if (!job.storageKey) {
        // Try to construct the key from faxId
        s3Key = s3Storage.generateFaxKey(job.faxId, 'pdf');
      } else {
        s3Key = job.storageKey;
      }
    }

    try {
      let imageBuffer: Buffer;

      // In test mode, try to load from local test-faxes directory first
      if (config.app.testMode && type === 'response' && job.actionResults?.responseFaxId) {
        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          const testFaxesDir = path.join(process.cwd(), 'test-faxes');

          // Find the file with the responseFaxId prefix
          const files = await fs.readdir(testFaxesDir);
          const matchingFile = files.find(f => f.startsWith(job.actionResults.responseFaxId));

          if (matchingFile) {
            const filePath = path.join(testFaxesDir, matchingFile);
            imageBuffer = await fs.readFile(filePath);
            console.log(`Loaded test fax from local storage: ${filePath}`);
          } else {
            // Fall back to S3
            imageBuffer = await s3Storage.downloadFile(s3Key);
          }
        } catch (localError) {
          console.log('Failed to load from local storage, trying S3:', localError);
          imageBuffer = await s3Storage.downloadFile(s3Key);
        }
      } else {
        // Load from S3
        imageBuffer = await s3Storage.downloadFile(s3Key);
      }

      // Check if the file is a PDF and convert to PNG for browser compatibility
      let displayBuffer: Buffer;
      let contentType: string;
      
      // Check if it's a PDF by looking at the magic bytes
      const isPdf = imageBuffer.slice(0, 4).toString() === '%PDF';
      
      if (isPdf) {
        // Convert PDF to PNG using pdf-to-png-converter
        const { pdfToPng } = await import('pdf-to-png-converter');
        const pngPages = await pdfToPng(imageBuffer, {
          disableFontFace: false,
          useSystemFonts: false,
          viewportScale: 2.0,
          outputFolder: undefined, // Return buffer instead of saving
        });
        
        // Use the first page
        if (pngPages.length > 0) {
          displayBuffer = pngPages[0].content;
          contentType = 'image/png';
        } else {
          throw new Error('PDF conversion resulted in no pages');
        }
      } else {
        // Already an image, just serve it
        displayBuffer = imageBuffer;
        contentType = 'image/png';
      }

      // Set appropriate headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `inline; filename="${type}_${job.faxId}.png"`);
      res.send(displayBuffer);
    } catch (downloadError) {
      console.error('Failed to download fax image from S3:', downloadError);
      return res.status(404).json({
        error: 'Image not found',
        message: `Fax image not found in storage`,
      });
    }
  } catch (error) {
    loggingService.error('Failed to fetch fax image', error as Error);
    res.status(500).json({
      error: 'Failed to fetch image',
      message: 'An error occurred while fetching the fax image',
    });
  }
});

// Download original fax PDF (inbound or response)
app.get('/admin/jobs/:id/fax-download', requireAdminAuth, requirePermission('jobs:view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type = 'inbound' } = req.query; // 'inbound' or 'response'

    const job = await faxJobRepository.findById(id);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Fax job with ID ${id} not found`,
      });
    }

    let s3Key: string;
    let filename: string;
    
    if (type === 'response' && job.actionResults?.responseFaxId) {
      // Get response fax PDF
      s3Key = s3Storage.generateFaxKey(job.actionResults.responseFaxId, 'pdf');
      filename = `response_${job.actionResults.responseFaxId}.pdf`;
    } else {
      // Get inbound fax PDF
      if (!job.storageKey) {
        s3Key = s3Storage.generateFaxKey(job.faxId, 'pdf');
      } else {
        s3Key = job.storageKey;
      }
      filename = `inbound_${job.faxId}.pdf`;
    }

    try {
      let pdfBuffer: Buffer;

      // In test mode, try to load from local test-faxes directory first
      if (config.app.testMode && type === 'response' && job.actionResults?.responseFaxId) {
        try {
          const fs = await import('fs/promises');
          const path = await import('path');
          const testFaxesDir = path.join(process.cwd(), 'test-faxes');

          const files = await fs.readdir(testFaxesDir);
          const matchingFile = files.find(f => f.startsWith(job.actionResults.responseFaxId));

          if (matchingFile) {
            const filePath = path.join(testFaxesDir, matchingFile);
            pdfBuffer = await fs.readFile(filePath);
            console.log(`Loaded test fax from local storage: ${filePath}`);
          } else {
            pdfBuffer = await s3Storage.downloadFile(s3Key);
          }
        } catch (localError) {
          console.log('Failed to load from local storage, trying S3:', localError);
          pdfBuffer = await s3Storage.downloadFile(s3Key);
        }
      } else {
        pdfBuffer = await s3Storage.downloadFile(s3Key);
      }

      // Serve the original PDF file
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (downloadError) {
      console.error('Failed to download fax PDF from S3:', downloadError);
      return res.status(404).json({
        error: 'PDF not found',
        message: `Fax PDF not found in storage`,
      });
    }
  } catch (error) {
    loggingService.error('Failed to fetch fax PDF', error as Error);
    res.status(500).json({
      error: 'Failed to fetch PDF',
      message: 'An error occurred while fetching the fax PDF',
    });
  }
});

// Get agent response data (LLM output)
app.get('/admin/jobs/:id/agent-response', requireAdminAuth, requirePermission('jobs:view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const job = await faxJobRepository.findById(id);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Fax job with ID ${id} not found`,
      });
    }

    // Get agent response from audit logs
    const agentLogs = await db.query(
      `SELECT event_data as "eventData", created_at as "createdAt"
       FROM audit_logs 
       WHERE fax_job_id = $1 
       AND event_type = 'fax_job.processing_complete'
       ORDER BY created_at DESC 
       LIMIT 1`,
      [id]
    );

    if (agentLogs.rows.length === 0) {
      return res.status(404).json({
        error: 'Agent response not found',
        message: 'No agent response data available for this job',
      });
    }

    const agentData = agentLogs.rows[0].eventData;

    res.json({
      agentResponse: agentData,
      timestamp: agentLogs.rows[0].createdAt,
    });
  } catch (error) {
    loggingService.error('Failed to fetch agent response', error as Error);
    res.status(500).json({
      error: 'Failed to fetch agent response',
      message: 'An error occurred while fetching the agent response data',
    });
  }
});

// User Management Endpoints
import { userRepository } from './repositories/userRepository';
import { conversationContextRepository } from './repositories/conversationContextRepository';
import { orderRepository } from './repositories/orderRepository';

// List users with search and pagination
app.get('/admin/users', requireAdminAuth, requirePermission('users:view'), async (req: Request, res: Response) => {
  try {
    const { search, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let query = 'SELECT * FROM users';
    const params: any[] = [];
    
    if (search) {
      query += ' WHERE phone_number LIKE $1 OR email_address LIKE $1 OR name LIKE $1';
      params.push(`%${search}%`);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limitNum, offset);

    const result = await db.query(query, params);
    
    const countQuery = search 
      ? 'SELECT COUNT(*) as count FROM users WHERE phone_number LIKE $1 OR email_address LIKE $1 OR name LIKE $1'
      : 'SELECT COUNT(*) as count FROM users';
    const countResult = await db.query(countQuery, search ? [`%${search}%`] : []);
    const total = parseInt(countResult.rows[0].count, 10);

    res.json({
      users: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    loggingService.error('Failed to fetch users', error as Error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user details
app.get('/admin/users/:id', requireAdminAuth, requirePermission('users:view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await userRepository.findById(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    loggingService.error('Failed to fetch user', error as Error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Get user activity
app.get('/admin/users/:id/activity', requireAdminAuth, requirePermission('users:view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '50' } = req.query;
    
    const logs = await db.query(
      `SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [id, parseInt(limit as string, 10)]
    );

    res.json({ activity: logs.rows });
  } catch (error) {
    loggingService.error('Failed to fetch user activity', error as Error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// Get user orders
app.get('/admin/users/:id/orders', requireAdminAuth, requirePermission('users:view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orders = await orderRepository.findByUserId(id);
    res.json({ orders });
  } catch (error) {
    loggingService.error('Failed to fetch user orders', error as Error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Delete user context
app.delete('/admin/users/:id/contexts/:contextId', requireAdminAuth, requirePermission('users:edit'), async (req: Request, res: Response) => {
  try {
    const { id, contextId } = req.params;
    await conversationContextRepository.delete(contextId);
    
    await auditLogService.log({
      userId: req.adminUser?.id,
      eventType: 'admin.context_deleted',
      eventData: {
        adminEmail: req.adminUser?.email,
        userId: id,
        contextId,
        timestamp: new Date().toISOString(),
      },
    });

    res.json({ message: 'Context deleted successfully' });
  } catch (error) {
    loggingService.error('Failed to delete context', error as Error);
    res.status(500).json({ error: 'Failed to delete context' });
  }
});

// MCP Monitoring Endpoints
import { mcpMonitoringService } from './services/mcpMonitoringService';

app.get('/admin/mcp/servers', requireAdminAuth, requirePermission('mcp:view'), async (req: Request, res: Response) => {
  try {
    const servers = await mcpMonitoringService.getServerStats();
    res.json({ servers });
  } catch (error) {
    loggingService.error('Failed to fetch MCP servers', error as Error);
    res.status(500).json({ error: 'Failed to fetch MCP servers' });
  }
});

app.get('/admin/mcp/external-apis', requireAdminAuth, requirePermission('mcp:view'), async (req: Request, res: Response) => {
  try {
    const apis = await mcpMonitoringService.getExternalAPIHealth();
    res.json({ apis });
  } catch (error) {
    loggingService.error('Failed to fetch external APIs', error as Error);
    res.status(500).json({ error: 'Failed to fetch external APIs' });
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

// Demo and Metrics API endpoints (for marketing website)
import { demoController } from './webhooks/demoController';
import { metricsController } from './webhooks/metricsController';

app.use('/api/demo', demoController);
app.use('/api/metrics', metricsController);

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
  // Serve favicon for test UI
  app.get('/favicon.ico', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../public/favicon.svg'));
  });
  
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

  // Control mock fax failure rate
  app.post('/test/fax/failure-rate', (req: Request, res: Response) => {
    try {
      const { rate } = req.body;
      
      if (typeof rate !== 'number' || rate < 0 || rate > 1) {
        return res.status(400).json({
          error: 'Invalid failure rate',
          message: 'Rate must be a number between 0 and 1'
        });
      }

      mockFaxSender.setFailureRate(rate);
      
      res.json({
        success: true,
        message: `Mock fax failure rate set to ${(rate * 100).toFixed(0)}%`,
        failureRate: rate
      });
    } catch (error) {
      console.error('Failed to set failure rate:', error);
      res.status(500).json({
        error: 'Failed to set failure rate',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Serve test UI
  app.get('/test', (req: Request, res: Response) => {
    const path = require('path');
    const testUIPath = path.join(__dirname, 'test', 'testUI.html');
    res.sendFile(testUIPath);
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

// Graceful shutdown with timeout
const SHUTDOWN_TIMEOUT = 5000; // 5 seconds max

async function gracefulShutdown(signal: string) {
  loggingService.info(`${signal} received, shutting down gracefully...`);
  console.log(`${signal} received, shutting down gracefully...`);

  // Force exit after timeout
  const forceExitTimeout = setTimeout(() => {
    console.log('Shutdown timeout reached, forcing exit...');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT);

  try {
    await Promise.race([
      Promise.all([
        emailToFaxWorker.stop(),
        faxProcessorWorker.shutdown(),
        db.close(),
        redis.close(),
      ]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Shutdown timeout')), SHUTDOWN_TIMEOUT - 500)
      )
    ]);
    loggingService.info('Graceful shutdown completed');
  } catch (error) {
    loggingService.error('Error during graceful shutdown', error as Error);
  }

  clearTimeout(forceExitTimeout);
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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
