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
    publicKey: z.string(),
    webhookTimeoutSeconds: z.number(),
  }),
  
  // Google Gemini
  gemini: z.object({
    apiKey: z.string(),
    model: z.string(),
  }),
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
      publicKey: process.env.TELNYX_PUBLIC_KEY || '',
      webhookTimeoutSeconds: parseInt(process.env.TELNYX_WEBHOOK_TIMEOUT || '5', 10),
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
    },
  };
}

// Validate and export configuration
export const config = configSchema.parse(buildConfig());
