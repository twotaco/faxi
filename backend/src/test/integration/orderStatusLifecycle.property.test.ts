/**
 * Property-Based Test: Order Status Lifecycle State Machine
 * Feature: amazon-shopping-mcp, Property 9: Order Status Lifecycle State Machine
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 * 
 * For any order, status transitions SHALL follow the valid state machine:
 * pending_payment → paid → pending_purchase → purchased → shipped → delivered
 * No invalid transitions SHALL occur.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import { orderManagementService, OrderStatus } from '../../services/orderManagementService';
import { userRepository } from '../../repositories/userRepository';
import { orderRepository } from '../../repositories/orderRepository';
import { db } from '../../database/connection';

describe('Property Test: Order Status Lifecycle State Machine', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user
    const testUser = await userRepository.create({
      phoneNumber: '+81-90-1234-5679',
      emailAddress: 'test-order-lifecycle@me.faxi.jp',
      name: 'Test User for Order Lifecycle'
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.query('DELETE FROM orders WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  /**
   * Valid state transitions for order status
   */
  const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    'pending_payment': ['paid', 'cancelled'],
    'paid': ['pending_purchase', 'cancelled'],
    'pending_purchase': ['purchased', 'cancelled'],
    'purchased': ['shipped', 'cancelled'],
    'shipped': ['delivered'],
    'delivered': [],
    'cancelled': []
  };

  /**
   * Property 9: Order Status Lifecycle State Machine
   * For any order, status transitions SHALL follow the valid state machine
   */
  it('property: order status transitions follow valid state machine', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a starting status
        fc.constantFrom<OrderStatus>(
          'pending_payment',
          'paid',
          'pending_purchase',
          'purchased',
          'shipped'
        ),
        // Generate a target status
        fc.constantFrom<OrderStatus>(
          'pending_payment',
          'paid',
          'pending_purchase',
          'purchased',
          'shipped',
          'delivered',
          'cancelled'
        ),
        async (fromStatus, toStatus) => {
          // Create an order with the starting status
          const order = await orderRepository.create({
            userId: testUserId,
            referenceId: `FX-2025-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
            status: fromStatus,
            totalAmount: 1000,
            currency: 'JPY',
            items: [{ asin: 'TEST123456', title: 'Test Product', price: 1000, quantity: 1 }],
            productAsin: 'TEST123456',
            productTitle: 'Test Product',
            quantity: 1,
            quotedPrice: 1000
          });

          // Determine if this is a valid transition
          const validNextStates = VALID_TRANSITIONS[fromStatus];
          const isValidTransition = validNextStates.includes(toStatus);

          try {
            // Attempt the transition
            await orderManagementService.updateOrderStatus(order.id, toStatus);

            // If we got here, the transition succeeded
            // It should only succeed if it was a valid transition
            expect(isValidTransition).toBe(true);

            // Verify the status was actually updated
            const updatedOrder = await orderRepository.findById(order.id);
            expect(updatedOrder?.status).toBe(toStatus);
          } catch (error: any) {
            // If we got an error, it should only be for invalid transitions
            expect(isValidTransition).toBe(false);
            expect(error.message).toContain('Invalid status transition');
          } finally {
            // Clean up this specific order
            await db.query('DELETE FROM orders WHERE id = $1', [order.id]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional test: Verify all valid transitions work correctly
   */
  it('property: all valid transitions succeed', async () => {
    const validTransitionPairs: Array<[OrderStatus, OrderStatus]> = [
      ['pending_payment', 'paid'],
      ['pending_payment', 'cancelled'],
      ['paid', 'pending_purchase'],
      ['paid', 'cancelled'],
      ['pending_purchase', 'purchased'],
      ['pending_purchase', 'cancelled'],
      ['purchased', 'shipped'],
      ['purchased', 'cancelled'],
      ['shipped', 'delivered']
    ];

    for (const [fromStatus, toStatus] of validTransitionPairs) {
      // Create an order with the starting status
      const order = await orderRepository.create({
        userId: testUserId,
        referenceId: `FX-2025-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
        status: fromStatus,
        totalAmount: 1000,
        currency: 'JPY',
        items: [{ asin: 'TEST123456', title: 'Test Product', price: 1000, quantity: 1 }],
        productAsin: 'TEST123456',
        productTitle: 'Test Product',
        quantity: 1,
        quotedPrice: 1000
      });

      // Attempt the transition - should succeed
      await expect(
        orderManagementService.updateOrderStatus(order.id, toStatus)
      ).resolves.not.toThrow();

      // Verify the status was updated
      const updatedOrder = await orderRepository.findById(order.id);
      expect(updatedOrder?.status).toBe(toStatus);

      // Clean up
      await db.query('DELETE FROM orders WHERE id = $1', [order.id]);
    }
  });

  /**
   * Additional test: Verify invalid transitions are rejected
   */
  it('property: invalid transitions are rejected', async () => {
    const invalidTransitionPairs: Array<[OrderStatus, OrderStatus]> = [
      ['pending_payment', 'pending_purchase'], // Skip paid
      ['pending_payment', 'purchased'], // Skip multiple states
      ['paid', 'shipped'], // Skip pending_purchase and purchased
      ['pending_purchase', 'delivered'], // Skip purchased and shipped
      ['shipped', 'pending_payment'], // Backwards transition
      ['delivered', 'shipped'], // From terminal state
      ['cancelled', 'paid'] // From terminal state
    ];

    for (const [fromStatus, toStatus] of invalidTransitionPairs) {
      // Create an order with the starting status
      const order = await orderRepository.create({
        userId: testUserId,
        referenceId: `FX-2025-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
        status: fromStatus,
        totalAmount: 1000,
        currency: 'JPY',
        items: [{ asin: 'TEST123456', title: 'Test Product', price: 1000, quantity: 1 }],
        productAsin: 'TEST123456',
        productTitle: 'Test Product',
        quantity: 1,
        quotedPrice: 1000
      });

      // Attempt the transition - should fail
      await expect(
        orderManagementService.updateOrderStatus(order.id, toStatus)
      ).rejects.toThrow('Invalid status transition');

      // Verify the status was NOT updated
      const unchangedOrder = await orderRepository.findById(order.id);
      expect(unchangedOrder?.status).toBe(fromStatus);

      // Clean up
      await db.query('DELETE FROM orders WHERE id = $1', [order.id]);
    }
  });
});
