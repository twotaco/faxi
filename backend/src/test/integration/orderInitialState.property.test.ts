/**
 * Property-Based Test: Order Initial State
 * Feature: amazon-shopping-mcp, Property 5: Order Initial State
 * Validates: Requirements 2.2, 2.3, 9.1
 * 
 * For any newly created order, the order status SHALL be "pending_payment" 
 * and the order SHALL be associated with a valid Reference ID.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import { orderManagementService } from '../../services/orderManagementService';
import { userRepository } from '../../repositories/userRepository';
import { db } from '../../database/connection';

describe('Property Test: Order Initial State', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user
    const testUser = await userRepository.create({
      phoneNumber: '+81-90-1234-5678',
      emailAddress: 'test-order-initial@me.faxi.jp',
      name: 'Test User for Order Initial State'
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.query('DELETE FROM orders WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  /**
   * Property 5: Order Initial State
   * For any newly created order, the order status SHALL be "pending_payment"
   * and the order SHALL be associated with a valid Reference ID
   */
  it('property: newly created orders have pending_payment status and valid reference ID', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random order data
        fc.record({
          productAsin: fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 10, maxLength: 10 }).map(arr => arr.join('')), // ASIN format
          productTitle: fc.string({ minLength: 10, maxLength: 100 }),
          quotedPrice: fc.integer({ min: 100, max: 100000 }), // 100 to 100,000 JPY
          quantity: fc.integer({ min: 1, max: 10 }),
          referenceId: fc.integer({ min: 1, max: 999999 }).map(n => 
            `FX-2025-${n.toString().padStart(6, '0')}`
          )
        }),
        async (orderData) => {
          // Create order
          const order = await orderManagementService.createOrder({
            userId: testUserId,
            referenceId: orderData.referenceId,
            productAsin: orderData.productAsin,
            productTitle: orderData.productTitle,
            quantity: orderData.quantity,
            quotedPrice: orderData.quotedPrice,
            shippingAddress: {
              name: 'Test User',
              postalCode: '100-0001',
              prefecture: 'Tokyo',
              city: 'Chiyoda',
              addressLine1: '1-1-1 Test Street'
            }
          });

          // Verify initial status is "pending_payment"
          expect(order.status).toBe('pending_payment');

          // Verify reference ID is set and valid
          expect(order.referenceId).toBe(orderData.referenceId);
          expect(order.referenceId).toMatch(/^FX-\d{4}-\d{6}$/);

          // Verify order is associated with the user
          expect(order.userId).toBe(testUserId);

          // Clean up this specific order
          await db.query('DELETE FROM orders WHERE id = $1', [order.id]);
        }
      ),
      { numRuns: 100 }
    );
  });
});
