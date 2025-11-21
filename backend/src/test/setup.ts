// CRITICAL: Set TEST_MODE before any imports
// This must be the very first thing to ensure all modules load in test mode
process.env.TEST_MODE = 'true';
process.env.NODE_ENV = 'test';

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import dotenv from 'dotenv';
import { vi } from 'vitest';

// Load test environment variables BEFORE any other imports
dotenv.config({ path: '.env.test' });

// Ensure critical test environment variables are set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/faxi_test';
}
if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = 'redis://localhost:6379/15';
}
if (!process.env.GEMINI_API_KEY) {
  process.env.GEMINI_API_KEY = 'test_gemini_key_mock';
}
if (!process.env.TELNYX_API_KEY) {
  process.env.TELNYX_API_KEY = 'test_telnyx_key_mock';
}
if (!process.env.STRIPE_SECRET_KEY) {
  process.env.STRIPE_SECRET_KEY = 'test_stripe_key_mock';
}
if (!process.env.AWS_ACCESS_KEY_ID) {
  process.env.AWS_ACCESS_KEY_ID = 'test_access_key';
}
if (!process.env.AWS_SECRET_ACCESS_KEY) {
  process.env.AWS_SECRET_ACCESS_KEY = 'test_secret_key';
}
if (!process.env.S3_BUCKET_NAME) {
  process.env.S3_BUCKET_NAME = 'test-faxi-bucket';
}

/**
 * External Service Mocking Strategy
 * 
 * Note: External services (Gemini AI, Telnyx, Stripe, AWS S3) are mocked at the
 * service implementation level when TEST_MODE=true, not via vi.mock().
 * 
 * This is because:
 * 1. Services are already imported before vi.mock() can take effect
 * 2. TEST_MODE allows services to use mock implementations internally
 * 3. This provides more realistic integration testing
 * 
 * Services that respect TEST_MODE:
 * - mockFaxSender: Used instead of real Telnyx API
 * - Database: Uses test database (faxi_test)
 * - Redis: Uses test database (DB 15)
 * - S3: Uses mock storage in TEST_MODE
 * 
 * For tests that need actual API mocking, use vi.spyOn() in individual test files.
 */

// Note: vi.mock() calls must be at the top level and will be hoisted
// However, since our services are already loaded, we rely on TEST_MODE
// environment variable for service-level mocking instead

// Global test data storage
declare global {
  var testFaxFiles: Map<string, Buffer>;
  var testResponseFaxes: Map<string, Buffer>;
  var testDatabaseConnections: any[];
}

// Initialize global test data storage
global.testFaxFiles = new Map();
global.testResponseFaxes = new Map();
global.testDatabaseConnections = [];

// Setup before all tests
beforeAll(async () => {
  console.log('Setting up test environment...');
  console.log('TEST_MODE:', process.env.TEST_MODE);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  
  // Verify test mode is enabled
  if (process.env.TEST_MODE !== 'true') {
    throw new Error('TEST_MODE must be set to "true" before running tests');
  }
  
  // Verify required test environment variables
  const requiredEnvVars = [
    'DATABASE_URL',
    'REDIS_URL',
    'GEMINI_API_KEY',
    'TELNYX_API_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'S3_BUCKET_NAME',
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.warn('Warning: Missing environment variables:', missingVars.join(', '));
    console.warn('Tests may fail if these services are required');
  }
  
  // Initialize test fixtures
  try {
    const { testFaxFixtureGenerator } = await import('./fixtures/createTestFaxes');
    testFaxFixtureGenerator.generateAllFixtures();
    console.log('Test fixtures generated successfully');
  } catch (error) {
    console.warn('Failed to generate test fixtures:', error);
  }
  
  console.log('Test environment setup complete');
  console.log('Note: External services (Gemini, Telnyx, S3) will use real APIs unless mocked in service implementations');
});

// Cleanup after all tests
afterAll(async () => {
  console.log('Cleaning up test environment...');
  
  try {
    // Close database connections
    if (global.testDatabaseConnections && global.testDatabaseConnections.length > 0) {
      for (const conn of global.testDatabaseConnections) {
        if (conn && typeof conn.close === 'function') {
          await conn.close();
        }
      }
      global.testDatabaseConnections = [];
    }
    
    // Clear test data
    global.testFaxFiles.clear();
    global.testResponseFaxes.clear();
    
    console.log('Test environment cleanup complete');
  } catch (error) {
    console.error('Error during test cleanup:', error);
  }
});

// Setup before each test
beforeEach(async () => {
  // Clear test data before each test to ensure isolation
  global.testFaxFiles.clear();
  global.testResponseFaxes.clear();
  
  // Reset any test-specific state
  // This ensures each test starts with a clean slate
});

// Cleanup after each test
afterEach(async () => {
  // Additional per-test cleanup if needed
  // This runs after each individual test
  
  // Clear any test-specific mocks or spies
  vi.clearAllMocks();
});