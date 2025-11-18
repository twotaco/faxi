import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Configuration schema for validation
const configSchema = z.object({
  // Database
  database: z.object({
    host: z.string(),
    port: z.number(),
    name: z.string(),
    user: z.string(),
    password: z.string(),
    pool: z.object({
      min: z.number(),
      max: z.number(),
    }),
  }),
  
  // Redis
  redis: z.object({
    host: z.string(),
    port: z.number(),
    password: z.string().optional(),
    db: z.number(),
  }),
  
  // S3
  s3: z.object({
    endpoint: z.string(),
    region: z.string(),
    bucket: z.string(),
    accessKeyId: z.string(),
    secretAccessKey: z.string(),
  }),
  
  // Application
  app: z.object({
    env: z.enum(['development', 'production', 'test']),
    port: z.number(),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']),
    testMode: z.boolean(),
  }),
  
  // Telnyx
  telnyx: z.object({
    apiKey: z.string(),
    publicKey: z.string(),
    faxNumber: z.string(),
    webhookTimeoutSeconds: z.number(),
  }),
  
  // Google Gemini
  gemini: z.object({
    apiKey: z.string(),
    model: z.string(),
  }),
  
  // Email
  email: z.object({
    provider: z.enum(['sendgrid', 'ses', 'postfix']),
    webhookSecret: z.string().optional(),
    sendgridApiKey: z.string().optional(),
    sesRegion: z.string().optional(),
    sesAccessKeyId: z.string().optional(),
    sesSecretAccessKey: z.string().optional(),
    postfixHost: z.string().optional(),
    postfixPort: z.number().optional(),
    postfixUser: z.string().optional(),
    postfixPassword: z.string().optional(),
    fromDomain: z.string(),
    smtp: z.object({
      host: z.string(),
      port: z.number(),
      secure: z.boolean(),
      user: z.string(),
      pass: z.string(),
    }).optional(),
  }),
  
  // Stripe
  stripe: z.object({
    secretKey: z.string(),
    publishableKey: z.string(),
    webhookSecret: z.string(),
  }),
  
  // Base URL for webhooks and redirects
  baseUrl: z.string(),
  
  // Worker configuration
  worker: z.object({
    concurrency: z.number(),
    maxStalledCount: z.number(),
    stalledInterval: z.number(),
  }).optional(),
  
  // Alerting configuration
  alerts: z.object({
    email: z.object({
      enabled: z.boolean(),
      smtpHost: z.string(),
      smtpPort: z.number(),
      username: z.string(),
      password: z.string(),
      from: z.string(),
      to: z.array(z.string()),
    }).optional(),
    slack: z.object({
      enabled: z.boolean(),
      webhookUrl: z.string(),
      channel: z.string(),
    }).optional(),
    pagerduty: z.object({
      enabled: z.boolean(),
      integrationKey: z.string(),
    }).optional(),
  }).optional(),
});

export type Config = z.infer<typeof configSchema>;

// Build configuration from environment variables
function buildConfig(): Config {
  return {
    database: {
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      name: process.env.DATABASE_NAME || 'faxi',
      user: process.env.DATABASE_USER || 'faxi_user',
      password: process.env.DATABASE_PASSWORD || '',
      pool: {
        min: parseInt(process.env.DATABASE_POOL_MIN || '2', 10),
        max: parseInt(process.env.DATABASE_POOL_MAX || '10', 10),
      },
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      db: parseInt(process.env.REDIS_DB || '0', 10),
    },
    s3: {
      endpoint: process.env.S3_ENDPOINT || 'https://s3.amazonaws.com',
      region: process.env.S3_REGION || 'us-east-1',
      bucket: process.env.S3_BUCKET || 'faxi-fax-images',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
    app: {
      env: (process.env.NODE_ENV as any) || 'development',
      port: parseInt(process.env.PORT || '3000', 10),
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
      testMode: process.env.TEST_MODE === 'true',
    },
    telnyx: {
      apiKey: process.env.TELNYX_API_KEY || '',
      publicKey: process.env.TELNYX_PUBLIC_KEY || '',
      faxNumber: process.env.TELNYX_FAX_NUMBER || '+1234567890',
      webhookTimeoutSeconds: parseInt(process.env.TELNYX_WEBHOOK_TIMEOUT || '5', 10),
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
    },
    email: {
      provider: (process.env.EMAIL_PROVIDER as any) || 'sendgrid',
      webhookSecret: process.env.EMAIL_WEBHOOK_SECRET,
      sendgridApiKey: process.env.SENDGRID_API_KEY,
      sesRegion: process.env.AWS_SES_REGION,
      sesAccessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
      sesSecretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
      postfixHost: process.env.POSTFIX_HOST,
      postfixPort: parseInt(process.env.POSTFIX_PORT || '587', 10),
      postfixUser: process.env.POSTFIX_USER,
      postfixPassword: process.env.POSTFIX_PASSWORD,
      fromDomain: process.env.EMAIL_FROM_DOMAIN || 'me.faxi.jp',
      smtp: process.env.SMTP_HOST ? {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      } : undefined,
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    },
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    worker: {
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '1', 10),
      maxStalledCount: parseInt(process.env.WORKER_MAX_STALLED_COUNT || '1', 10),
      stalledInterval: parseInt(process.env.WORKER_STALLED_INTERVAL || '30000', 10),
    },
    alerts: {
      email: process.env.ALERTS_EMAIL_ENABLED === 'true' ? {
        enabled: true,
        smtpHost: process.env.ALERTS_EMAIL_SMTP_HOST || '',
        smtpPort: parseInt(process.env.ALERTS_EMAIL_SMTP_PORT || '587', 10),
        username: process.env.ALERTS_EMAIL_USERNAME || '',
        password: process.env.ALERTS_EMAIL_PASSWORD || '',
        from: process.env.ALERTS_EMAIL_FROM || '',
        to: (process.env.ALERTS_EMAIL_TO || '').split(',').filter(Boolean),
      } : undefined,
      slack: process.env.ALERTS_SLACK_ENABLED === 'true' ? {
        enabled: true,
        webhookUrl: process.env.ALERTS_SLACK_WEBHOOK_URL || '',
        channel: process.env.ALERTS_SLACK_CHANNEL || '#alerts',
      } : undefined,
      pagerduty: process.env.ALERTS_PAGERDUTY_ENABLED === 'true' ? {
        enabled: true,
        integrationKey: process.env.ALERTS_PAGERDUTY_INTEGRATION_KEY || '',
      } : undefined,
    },
  };
}

// Validate and export configuration
export const config = configSchema.parse(buildConfig());
