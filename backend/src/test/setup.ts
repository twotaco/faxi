import { beforeAll, afterAll, beforeEach } from 'vitest';
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Ensure test mode is enabled
process.env.TEST_MODE = 'true';
process.env.NODE_ENV = 'test';

// Mock external services for testing
beforeAll(async () => {
  console.log('Setting up test environment...');
  
  // Mock Redis connection to avoid connection errors
  if (!process.env.REDIS_URL) {
    process.env.REDIS_URL = 'redis://localhost:6379/15'; // Use test DB
  }
  
  // Mock database connection
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/faxi_test';
  }
  
  // Set up any other test infrastructure
});

afterAll(async () => {
  console.log('Cleaning up test environment...');
  
  // Clean up test data
  // Close database connections
  // Clean up any test files
});

beforeEach(async () => {
  // Clear test data before each test
  if ((global as any).testFaxFiles) {
    (global as any).testFaxFiles.clear();
  }
  
  if ((global as any).testResponseFaxes) {
    (global as any).testResponseFaxes.clear();
  }
});