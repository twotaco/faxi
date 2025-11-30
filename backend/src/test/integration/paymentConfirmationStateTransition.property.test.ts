import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fc from 'fast-check';
import { db } from '../../database/connection';
import { paymentService } from '../../services/paymentService';
import { userRepository } from '../../repositories/userRepository';
import { orderRepository } from '../../repositories/orderRepository';
import Stripe from 'stripe';

/**
 * Feature: amazon-shopping-mcp, Property 8: Payment Confirmation State Transition
 * Validates: Requirements 3.5, 9.2
 * 
 * Property: For any payment confirmation webhook from Stripe, the corresponding order
 * status SHALL transition to "paid".
 */

describe('Property 8: Payment Confirmation State Transition', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create a test user for all property tests
    const testUser = await userRepository.create({
      phoneNumber: '+81-90-7777-6666',
      emailAddress: 'test-payment-confirmation@me.faxi.jp',
      name: 'Test User for Payment Confirmation'
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // Clean up test data
    await db.query('DELETE FROM orders WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  /**
   * Property 8: Payment Confirmation State Transition
   * For any payment confirmation webhook, the order status SHALL transition to "paid"
   */
  it('property: payment success webhook transitions order to paid status', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random order amount (1000-100000 yen)
        fc.integer({ min: 1000, max: 100000 }),
        // Generate random product ASIN
        fc.array(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), { minLength: 10, maxLength: 10 }).map(arr => arr.join('')),
        async (amount, asin) => {
          // Create test order in pending_payment status
          const order = await orderRepository.create({
            userId: testUserId,
            referenceId: `FX-${Date.now().toString().slice(-10)}`,
            type: 'shopping',
            status: 'pending_payment',
            totalAmount: amount,
            currency: 'JPY',
            items: [{ asin, title: 'Test Product', price: amount, quantity: 1 }],
            shippingAddress: {
              name: 'Test User',
              postalCode: '100-0001',
              prefecture: 'Tokyo',
              city: 'Chiyoda',
              addressLine1: '1-1-1',
              phoneNumber: '+81-90-7777-6666',
            },
            productAsin: asin,
            productTitle: 'Test Product',
            quantity: 1,
            quotedPrice: amount,
            stripePaymentIntentId: `pi_test_${Date.now()}_${Math.random()}`,
          });

          // Verify initial status
          expect(order.status).toBe('pending_payment');

          // Simulate payment success webhook
          const mockPaymentIntent: Partial<Stripe.PaymentIntent> = {
            id: order.stripePaymentIntentId!,
            amount: amount,
            currency: 'jpy',
            status: 'succeeded',
            metadata: {
              orderId: order.id,
              referenceId: order.referenceId,
              userId: testUserId,
            },
          };

          const mockEvent: Partial<Stripe.Event> = {
            id: `evt_test_${Date.now()}`,
            type: 'payment_intent.succeeded',
            data: {
              object: mockPaymentIntent as Stripe.PaymentIntent,
            } as any,
          };

          // Handle the webhook
          await paymentService.handlePaymentWebhook(mockEvent as Stripe.Event);

          // Verify order status transitioned to "paid"
          const updatedOrder = await orderRepository.findById(order.id);
          expect(updatedOrder).not.toBeNull();
          expect(updatedOrder!.status).toBe('paid');

          // Property: Payment confirmation webhook SHALL transition order to "paid" status
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Payment failure webhook does not transition to paid
   */
  it('property: payment failure webhook does not transition order to paid status', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random order amount
        fc.integer({ min: 1000, max: 100000 }),
        async (amount) => {
          // Create test order in pending_payment status
          const order = await orderRepository.create({
            userId: testUserId,
            referenceId: `FX-${Date.now().toString().slice(-10)}`,
            type: 'shopping',
            status: 'pending_payment',
            totalAmount: amount,
            currency: 'JPY',
            items: [],
            shippingAddress: {},
            stripePaymentIntentId: `pi_test_${Date.now()}_${Math.random()}`,
          });

          // Verify initial status
          expect(order.status).toBe('pending_payment');

          // Simulate payment failure webhook
          const mockPaymentIntent: Partial<Stripe.PaymentIntent> = {
            id: order.stripePaymentIntentId!,
            amount: amount,
            currency: 'jpy',
            status: 'requires_payment_method',
            metadata: {
              orderId: order.id,
              referenceId: order.referenceId,
              userId: testUserId,
            },
            last_payment_error: {
              message: 'Your card was declined',
            } as any,
          };

          const mockEvent: Partial<Stripe.Event> = {
            id: `evt_test_${Date.now()}`,
            type: 'payment_intent.payment_failed',
            data: {
              object: mockPaymentIntent as Stripe.PaymentIntent,
            } as any,
          };

          // Handle the webhook
          await paymentService.handlePaymentWebhook(mockEvent as Stripe.Event);

          // Verify order status remains "pending_payment"
          const updatedOrder = await orderRepository.findById(order.id);
          expect(updatedOrder).not.toBeNull();
          expect(updatedOrder!.status).toBe('pending_payment');

          // Property: Payment failure SHALL NOT transition order to "paid" status
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Payment cancellation transitions to cancelled
   */
  it('property: payment cancellation webhook transitions order to cancelled status', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random order amount
        fc.integer({ min: 1000, max: 100000 }),
        async (amount) => {
          // Create test order in pending_payment status
          const order = await orderRepository.create({
            userId: testUserId,
            referenceId: `FX-${Date.now().toString().slice(-10)}`,
            type: 'shopping',
            status: 'pending_payment',
            totalAmount: amount,
            currency: 'JPY',
            items: [],
            shippingAddress: {},
            stripePaymentIntentId: `pi_test_${Date.now()}_${Math.random()}`,
          });

          // Verify initial status
          expect(order.status).toBe('pending_payment');

          // Simulate payment cancellation webhook
          const mockPaymentIntent: Partial<Stripe.PaymentIntent> = {
            id: order.stripePaymentIntentId!,
            amount: amount,
            currency: 'jpy',
            status: 'canceled',
            metadata: {
              orderId: order.id,
              referenceId: order.referenceId,
              userId: testUserId,
            },
          };

          const mockEvent: Partial<Stripe.Event> = {
            id: `evt_test_${Date.now()}`,
            type: 'payment_intent.canceled',
            data: {
              object: mockPaymentIntent as Stripe.PaymentIntent,
            } as any,
          };

          // Handle the webhook
          await paymentService.handlePaymentWebhook(mockEvent as Stripe.Event);

          // Verify order status transitioned to "cancelled"
          const updatedOrder = await orderRepository.findById(order.id);
          expect(updatedOrder).not.toBeNull();
          expect(updatedOrder!.status).toBe('cancelled');

          // Property: Payment cancellation SHALL transition order to "cancelled" status
        }
      ),
      { numRuns: 100 }
    );
  });
});
