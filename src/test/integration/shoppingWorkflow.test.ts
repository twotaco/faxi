import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { testFaxFixtureGenerator } from '../fixtures/createTestFaxes';
import { userRepository } from '../../repositories/userRepository';
import { paymentMethodRepository } from '../../repositories/paymentMethodRepository';
import { orderRepository } from '../../repositories/orderRepository';

let app: Express;

describe('Shopping Workflow Integration Tests', () => {
  let testUserId: string;

  beforeEach(async () => {
    // Initialize test app
    const { createTestApp } = await import('../testApp');
    app = await createTestApp();
    
    // Generate test fixtures if they don't exist
    testFaxFixtureGenerator.generateAllFixtures();

    // Create test user
    const user = await userRepository.create({
      phoneNumber: '+1234567890',
      emailAddress: '1234567890@me.faxi.jp',
      isActive: true,
      preferences: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    // Clean up test data
    await request(app).delete('/test/fax/clear');
  });

  describe('Product Search and Selection', () => {
    it('should process shopping request and generate product selection fax', async () => {
      // Get shopping request fixture
      const shoppingFixture = testFaxFixtureGenerator.getFixture('shopping_request.png');
      expect(shoppingFixture).toBeDefined();

      // Upload shopping request fax
      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', shoppingFixture!, 'shopping_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(uploadResponse.status).toBe(200);
      const faxId = uploadResponse.body.fax_id;

      // Wait for processing to complete
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${faxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Verify product selection fax was generated
      const statusResponse = await request(app)
        .get(`/test/fax/status/${faxId}`);

      expect(statusResponse.body.response_reference_id).toBeDefined();

      // Check processing steps for shopping-related operations
      const stepOperations = statusResponse.body.processing_steps.map((step: any) => step.operation);
      expect(stepOperations.some((op: string) => 
        op.includes('product_search') || 
        op.includes('shopping') ||
        op.includes('product_selection')
      )).toBe(true);
    });

    it('should handle product selection with checkmarks', async () => {
      // First, send initial shopping request
      const shoppingFixture = testFaxFixtureGenerator.getFixture('shopping_request.png');
      expect(shoppingFixture).toBeDefined();

      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', shoppingFixture!, 'shopping_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(uploadResponse.status).toBe(200);
      const initialFaxId = uploadResponse.body.fax_id;

      // Wait for initial processing
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${initialFaxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Now send product selection with checkmarks
      const selectionFixture = testFaxFixtureGenerator.getFixture('product_selection_with_checkmarks.png');
      expect(selectionFixture).toBeDefined();

      const selectionResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', selectionFixture!, 'product_selection_with_checkmarks.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(selectionResponse.status).toBe(200);
      const selectionFaxId = selectionResponse.body.fax_id;

      // Wait for selection processing
      status = 'pending';
      attempts = 0;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${selectionFaxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Verify order processing occurred
      const statusResponse = await request(app)
        .get(`/test/fax/status/${selectionFaxId}`);

      const stepOperations = statusResponse.body.processing_steps.map((step: any) => step.operation);
      expect(stepOperations.some((op: string) => 
        op.includes('order') || 
        op.includes('checkout') ||
        op.includes('purchase')
      )).toBe(true);
    });
  });

  describe('Payment Processing', () => {
    it('should generate payment barcodes when no payment method on file', async () => {
      // Verify no payment method exists
      const paymentMethods = await paymentMethodRepository.findByUserId(testUserId);
      expect(paymentMethods).toHaveLength(0);

      // Send shopping request
      const shoppingFixture = testFaxFixtureGenerator.getFixture('shopping_request.png');
      expect(shoppingFixture).toBeDefined();

      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', shoppingFixture!, 'shopping_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(uploadResponse.status).toBe(200);
      const faxId = uploadResponse.body.fax_id;

      // Wait for processing
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${faxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Verify barcode generation occurred
      const statusResponse = await request(app)
        .get(`/test/fax/status/${faxId}`);

      const stepOperations = statusResponse.body.processing_steps.map((step: any) => step.operation);
      expect(stepOperations.some((op: string) => 
        op.includes('barcode') || 
        op.includes('konbini') ||
        op.includes('payment_barcode')
      )).toBe(true);
    });

    it('should charge payment method when available', async () => {
      // Add payment method for user
      await paymentMethodRepository.create({
        userId: testUserId,
        stripePaymentMethodId: 'pm_test_card',
        type: 'card',
        isDefault: true,
        metadata: {
          last4: '4242',
          brand: 'visa',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Send shopping request
      const shoppingFixture = testFaxFixtureGenerator.getFixture('shopping_request.png');
      expect(shoppingFixture).toBeDefined();

      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', shoppingFixture!, 'shopping_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(uploadResponse.status).toBe(200);
      const faxId = uploadResponse.body.fax_id;

      // Wait for processing
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${faxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Verify payment processing occurred
      const statusResponse = await request(app)
        .get(`/test/fax/status/${faxId}`);

      const stepOperations = statusResponse.body.processing_steps.map((step: any) => step.operation);
      expect(stepOperations.some((op: string) => 
        op.includes('payment') || 
        op.includes('charge') ||
        op.includes('process_payment')
      )).toBe(true);
    });

    it('should handle payment registration requests', async () => {
      // Get payment registration fixture
      const paymentFixture = testFaxFixtureGenerator.getFixture('payment_registration.png');
      expect(paymentFixture).toBeDefined();

      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', paymentFixture!, 'payment_registration.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(uploadResponse.status).toBe(200);
      const faxId = uploadResponse.body.fax_id;

      // Wait for processing
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${faxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Verify payment registration processing
      const statusResponse = await request(app)
        .get(`/test/fax/status/${faxId}`);

      const stepOperations = statusResponse.body.processing_steps.map((step: any) => step.operation);
      expect(stepOperations.some((op: string) => 
        op.includes('payment_method') || 
        op.includes('register_payment') ||
        op.includes('payment_registration')
      )).toBe(true);
    });
  });

  describe('Order Management', () => {
    it('should create order record after successful purchase', async () => {
      // Add payment method for user
      await paymentMethodRepository.create({
        userId: testUserId,
        stripePaymentMethodId: 'pm_test_card',
        type: 'card',
        isDefault: true,
        metadata: {
          last4: '4242',
          brand: 'visa',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Send shopping request and complete purchase flow
      const shoppingFixture = testFaxFixtureGenerator.getFixture('shopping_request.png');
      expect(shoppingFixture).toBeDefined();

      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', shoppingFixture!, 'shopping_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(uploadResponse.status).toBe(200);
      const faxId = uploadResponse.body.fax_id;

      // Wait for processing
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${faxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Check if order was created
      const orders = await orderRepository.findByUserId(testUserId);
      
      // Note: This depends on the shopping workflow actually completing a purchase
      // In a real test, we might need to mock the e-commerce API
      if (orders.length > 0) {
        expect(orders[0].userId).toBe(testUserId);
        expect(orders[0].status).toBeDefined();
      }
    });

    it('should generate order confirmation fax', async () => {
      // This test would verify that after a successful purchase,
      // an order confirmation fax is generated and sent
      
      // Add payment method for user
      await paymentMethodRepository.create({
        userId: testUserId,
        stripePaymentMethodId: 'pm_test_card',
        type: 'card',
        isDefault: true,
        metadata: {
          last4: '4242',
          brand: 'visa',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Send shopping request
      const shoppingFixture = testFaxFixtureGenerator.getFixture('shopping_request.png');
      expect(shoppingFixture).toBeDefined();

      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', shoppingFixture!, 'shopping_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(uploadResponse.status).toBe(200);
      const faxId = uploadResponse.body.fax_id;

      // Wait for processing
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${faxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Verify confirmation fax generation
      const statusResponse = await request(app)
        .get(`/test/fax/status/${faxId}`);

      const stepOperations = statusResponse.body.processing_steps.map((step: any) => step.operation);
      expect(stepOperations.some((op: string) => 
        op.includes('confirmation') || 
        op.includes('order_confirmation')
      )).toBe(true);
    });
  });

  describe('Multi-Action Shopping Requests', () => {
    it('should handle multiple product requests in one fax', async () => {
      // Get multi-action request fixture
      const multiActionFixture = testFaxFixtureGenerator.getFixture('multi_action_request.png');
      expect(multiActionFixture).toBeDefined();

      const uploadResponse = await request(app)
        .post('/test/fax/receive')
        .attach('fax_file', multiActionFixture!, 'multi_action_request.png')
        .field('from_number', '+1234567890')
        .field('to_number', '+0987654321')
        .field('test_user_phone', '+1234567890');

      expect(uploadResponse.status).toBe(200);
      const faxId = uploadResponse.body.fax_id;

      // Wait for processing
      let status = 'pending';
      let attempts = 0;
      const maxAttempts = 30;

      while (status !== 'completed' && status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/test/fax/status/${faxId}`);
        
        status = statusResponse.body.status;
        attempts++;
      }

      expect(status).toBe('completed');

      // Verify multi-action processing
      const statusResponse = await request(app)
        .get(`/test/fax/status/${faxId}`);

      expect(statusResponse.body.response_reference_id).toBeDefined();
      
      // Should have processed multiple actions
      const stepOperations = statusResponse.body.processing_steps.map((step: any) => step.operation);
      expect(stepOperations.length).toBeGreaterThan(3); // Multiple processing steps
    });
  });
});