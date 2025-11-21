import Redis from 'ioredis';
import { config } from '../config';

class RedisConnection {
  private client: Redis;
  private static instance: RedisConnection;

  private constructor() {
    this.client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      maxRetriesPerRequest: null, // Required by BullMQ for blocking operations
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      },
    });

    this.client.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis connected');
    });

    this.client.on('ready', () => {
      console.log('Redis ready');
    });

    this.client.on('close', () => {
      console.log('Redis connection closed');
    });
  }

  public static getInstance(): RedisConnection {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new RedisConnection();
    }
    return RedisConnection.instance;
  }

  public getClient(): Redis {
    return this.client;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }

  public async close(): Promise<void> {
    await this.client.quit();
  }
}

export const redis = RedisConnection.getInstance();
