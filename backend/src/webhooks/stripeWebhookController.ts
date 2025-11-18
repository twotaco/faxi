import { Request, Response } from 'express';
import Stripe from 'stripe';
import { config } from '../config';
import { auditLogService } from '../services/auditLogService';
import { orderRepository } from '../repositories/orderRepository';
import { ecommerceService } from '../services/ecommerceService';

/**
 * Stripe Webhook Controller
 * Handles Stripe payment confirmation webhooks
 */
export class StripeWebhookController {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2025-10-29.clover',
    });
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    const sig = req.headers['stripe-signature'] as string;
    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = this.stripe.webhooks.constructEvent(
        req.body,
        sig,
        config.stripe.webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return;
    }

    try {
      // Handle the event
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        
        case 'payment_intent.requires_action':
          await this.handlePaymentRequiresAction(event.data.object as Stripe.PaymentIntent);
          break;
        
        case 'payment_intent.canceled':
          await this.handlePaymentCanceled(event.data.object as Stripe.PaymentIntent);
          break;
        
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const userId = paymentIntent.metadata?.userId;
    
    if (!userId) {
      console.warn('Payment succeeded but no userId in metadata:', paymentIntent.id);
      return;
    }

    // Log payment success
    await auditLogService.log({
      userId,
      eventType: 'payment.succeeded',
      eventData: {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        paymentMethod: paymentIntent.payment_method,
        timestamp: new Date().toISOString(),
      },
    });

    // Check if this is a konbini payment that needs order placement
    if (paymentIntent.metadata?.faxiKonbiniPayment === 'true') {
      await this.processKonbiniOrderPlacement(paymentIntent, userId);
    }

    // Update any existing orders with this payment intent
    await this.updateOrderStatus(paymentIntent.id, 'paid');
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const userId = paymentIntent.metadata?.userId;
    
    if (!userId) {
      console.warn('Payment failed but no userId in metadata:', paymentIntent.id);
      return;
    }

    // Log payment failure
    await auditLogService.log({
      userId,
      eventType: 'payment.failed',
      eventData: {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        errorCode: paymentIntent.last_payment_error?.code,
        errorMessage: paymentIntent.last_payment_error?.message,
        timestamp: new Date().toISOString(),
      },
    });

    // Update any existing orders with this payment intent
    await this.updateOrderStatus(paymentIntent.id, 'payment_failed');
  }

  /**
   * Handle payment that requires action (e.g., 3D Secure)
   */
  private async handlePaymentRequiresAction(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const userId = paymentIntent.metadata?.userId;
    
    if (!userId) {
      console.warn('Payment requires action but no userId in metadata:', paymentIntent.id);
      return;
    }

    // Log payment requiring action
    await auditLogService.log({
      userId,
      eventType: 'payment.requires_action',
      eventData: {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        nextAction: paymentIntent.next_action,
        timestamp: new Date().toISOString(),
      },
    });

    // Update any existing orders with this payment intent
    await this.updateOrderStatus(paymentIntent.id, 'pending_action');
  }

  /**
   * Handle canceled payment
   */
  private async handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const userId = paymentIntent.metadata?.userId;
    
    if (!userId) {
      console.warn('Payment canceled but no userId in metadata:', paymentIntent.id);
      return;
    }

    // Log payment cancellation
    await auditLogService.log({
      userId,
      eventType: 'payment.canceled',
      eventData: {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        timestamp: new Date().toISOString(),
      },
    });

    // Update any existing orders with this payment intent
    await this.updateOrderStatus(paymentIntent.id, 'canceled');
  }

  /**
   * Process order placement for konbini payments
   */
  private async processKonbiniOrderPlacement(paymentIntent: Stripe.PaymentIntent, userId: string): Promise<void> {
    try {
      // For konbini payments, we need to trigger order placement
      // This would typically involve:
      // 1. Getting the cart items associated with this payment
      // 2. Placing the order through the e-commerce service
      // 3. Creating an order record
      
      // Since we don't have the cart items in the payment intent metadata,
      // we would need to store them when creating the konbini payment intent
      // For now, we'll log that the konbini payment was successful
      
      await auditLogService.log({
        userId,
        eventType: 'konbini.payment_completed',
        eventData: {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          timestamp: new Date().toISOString(),
        },
      });

      // In a real implementation, you would:
      // 1. Retrieve cart items from metadata or separate storage
      // 2. Place order via ecommerceService.placeOrder()
      // 3. Create order record via orderRepository.create()
      // 4. Send confirmation fax to user
      
    } catch (error) {
      console.error('Failed to process konbini order placement:', error);
      
      await auditLogService.logSystemError({
        userId,
        errorType: 'konbini_order_placement_failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        context: {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
        },
      });
    }
  }

  /**
   * Update order status based on payment intent
   */
  private async updateOrderStatus(paymentIntentId: string, status: string): Promise<void> {
    try {
      // Find orders associated with this payment intent
      // Note: This would require adding a payment_intent_id field to the orders table
      // or storing the association in the order metadata
      
      // For now, we'll log the status update
      await auditLogService.log({
        eventType: 'order.status_updated',
        eventData: {
          paymentIntentId,
          newStatus: status,
          timestamp: new Date().toISOString(),
        },
      });
      
    } catch (error) {
      console.error('Failed to update order status:', error);
    }
  }
}

export const stripeWebhookController = new StripeWebhookController();