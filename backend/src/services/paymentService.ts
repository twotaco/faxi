import Stripe from 'stripe';
import { orderRepository, Order } from '../repositories/orderRepository';
import { paymentMethodRepository } from '../repositories/paymentMethodRepository';
import { userRepository } from '../repositories/userRepository';
import { auditLogService } from './auditLogService';
import { loggingService } from './loggingService';
import { shoppingMetricsService } from './shoppingMetricsService';

/**
 * Bank transfer instructions for user
 */
export interface BankTransferInstructions {
  paymentIntentId: string;
  bankName: string;
  branchName?: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  referenceCode: string;
  expiresAt: Date;
  hostedInstructionsUrl?: string;
}

/**
 * Parameters for initiating bank transfer
 */
export interface InitiateBankTransferParams {
  userId: string;
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
}

/**
 * Result of bank transfer initiation
 */
export interface BankTransferResult {
  success: boolean;
  paymentIntent?: Stripe.PaymentIntent;
  bankTransferDetails?: BankTransferInstructions;
  error?: string;
}

/**
 * Payment service for shopping orders
 * Handles payment processing via Stripe for both card and bank transfer
 */
export class PaymentService {
  private stripe: Stripe;

  constructor() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-10-29.clover',
    });
  }

  /**
   * Create payment intent for order
   * @param orderId - Order ID
   * @param amount - Amount in Japanese Yen
   * @param paymentMethodId - Optional Stripe payment method ID for auto-charge
   */
  async createPaymentIntent(
    orderId: string,
    amount: number,
    paymentMethodId?: string
  ): Promise<Stripe.PaymentIntent> {
    try {
      const order = await orderRepository.findById(orderId);
      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      const user = await userRepository.findById(order.userId);
      if (!user) {
        throw new Error(`User not found: ${order.userId}`);
      }

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await this.stripe.customers.create({
          phone: user.phoneNumber,
          metadata: {
            userId: user.id,
            phoneNumber: user.phoneNumber,
          },
        });
        customerId = customer.id;
        
        // Update user with Stripe customer ID
        await userRepository.update(user.id, { stripeCustomerId: customerId });
      }

      const paymentIntentData: Stripe.PaymentIntentCreateParams = {
        amount: Math.round(amount), // Stripe expects amount in smallest currency unit (yen)
        currency: 'jpy',
        customer: customerId,
        metadata: {
          orderId,
          referenceId: order.referenceId,
          userId: order.userId,
        },
        description: `Faxi Shopping Order ${order.referenceId}`,
      };

      // If payment method provided, attach it for auto-charge
      if (paymentMethodId) {
        paymentIntentData.payment_method = paymentMethodId;
        paymentIntentData.confirm = true;
        paymentIntentData.automatic_payment_methods = {
          enabled: true,
          allow_redirects: 'never',
        };
      }

      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentData);

      // Update order with payment intent ID
      await orderRepository.update(orderId, {
        stripePaymentIntentId: paymentIntent.id,
      });

      // Log audit trail
      await auditLogService.log({
        userId: order.userId,
        eventType: 'payment.intent_created',
        eventData: {
          orderId,
          paymentIntentId: paymentIntent.id,
          amount,
          paymentMethodId,
          timestamp: new Date().toISOString(),
        },
      });

      loggingService.info('Payment intent created', {
        orderId,
        paymentIntentId: paymentIntent.id,
        amount,
      });

      return paymentIntent;
    } catch (error) {
      loggingService.error('Failed to create payment intent', {
        orderId,
        amount,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Charge saved payment method for order
   * @param userId - User ID
   * @param amount - Amount in Japanese Yen
   * @param orderId - Order ID
   */
  async chargePaymentMethod(
    userId: string,
    amount: number,
    orderId: string
  ): Promise<Stripe.PaymentIntent> {
    const startTime = Date.now();
    
    try {
      // Get default payment method
      const paymentMethod = await paymentMethodRepository.findDefaultByUserId(userId);
      if (!paymentMethod) {
        throw new Error(`No default payment method found for user: ${userId}`);
      }

      // Create and confirm payment intent
      const paymentIntent = await this.createPaymentIntent(
        orderId,
        amount,
        paymentMethod.stripePaymentMethodId
      );

      const processingTime = Date.now() - startTime;

      // Log audit trail
      await auditLogService.log({
        userId,
        eventType: 'payment.charged',
        eventData: {
          orderId,
          paymentIntentId: paymentIntent.id,
          amount,
          paymentMethodId: paymentMethod.id,
          timestamp: new Date().toISOString(),
        },
      });

      // Record payment metrics
      await shoppingMetricsService.recordPaymentMetric(
        true,
        amount,
        'card',
        processingTime
      );

      loggingService.info('Payment method charged', {
        userId,
        orderId,
        paymentIntentId: paymentIntent.id,
        amount,
        processingTime,
      });

      return paymentIntent;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Record failed payment metrics
      await shoppingMetricsService.recordPaymentMetric(
        false,
        amount,
        'card',
        processingTime,
        error instanceof Error ? error.message : String(error)
      );
      
      loggingService.error('Failed to charge payment method', {
        userId,
        orderId,
        amount,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Initiate bank transfer payment for an order
   * Uses Stripe's customer_balance with jp_bank_transfer for Japanese bank transfers
   * @param params - Bank transfer parameters including userId, amount, and metadata
   */
  async initiateBankTransfer(params: InitiateBankTransferParams): Promise<BankTransferResult> {
    const startTime = Date.now();

    try {
      const { userId, amount, currency, description, metadata } = params;

      // Get user
      const user = await userRepository.findById(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await this.stripe.customers.create({
          phone: user.phoneNumber,
          email: user.emailAddress,
          name: user.name || user.deliveryName || undefined,
          metadata: {
            userId: user.id,
            phoneNumber: user.phoneNumber,
          },
        });
        customerId = customer.id;

        // Update user with Stripe customer ID
        await userRepository.update(user.id, { stripeCustomerId: customerId });
      }

      // Create payment intent for bank transfer
      // Note: customer_balance with bank_transfer requires specific configuration
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount),
        currency: currency.toLowerCase(),
        customer: customerId,
        payment_method_types: ['customer_balance'],
        payment_method_data: {
          type: 'customer_balance',
        },
        payment_method_options: {
          customer_balance: {
            funding_type: 'bank_transfer',
            bank_transfer: {
              type: 'jp_bank_transfer',
            },
          },
        },
        description,
        metadata: {
          ...metadata,
          userId,
        },
      });

      // Extract bank transfer details from next_action if available
      let bankTransferDetails: BankTransferInstructions;

      if (paymentIntent.next_action?.display_bank_transfer_instructions) {
        const instructions = paymentIntent.next_action.display_bank_transfer_instructions;
        const jpInstructions = instructions.financial_addresses?.[0]?.zengin;
        // Cast instructions to access expires_at which may exist on newer API versions
        const instructionsAny = instructions as unknown as Record<string, unknown>;

        bankTransferDetails = {
          paymentIntentId: paymentIntent.id,
          bankName: jpInstructions?.bank_name || 'Stripe Bank',
          branchName: jpInstructions?.branch_name ?? undefined,
          accountNumber: jpInstructions?.account_number || 'See instructions',
          accountName: jpInstructions?.account_holder_name || 'Faxi Inc.',
          amount,
          referenceCode: instructions.reference || metadata?.referenceId || paymentIntent.id,
          expiresAt: typeof instructionsAny.expires_at === 'number'
            ? new Date(instructionsAny.expires_at * 1000)
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          hostedInstructionsUrl: instructions.hosted_instructions_url ?? undefined,
        };
      } else {
        // Fallback if next_action not available yet
        bankTransferDetails = {
          paymentIntentId: paymentIntent.id,
          bankName: 'Stripe Bank Transfer',
          accountNumber: 'See payment page',
          accountName: 'Faxi Inc.',
          amount,
          referenceCode: metadata?.referenceId || paymentIntent.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        };
      }

      const processingTime = Date.now() - startTime;

      // Log audit trail
      await auditLogService.log({
        userId,
        eventType: 'payment.bank_transfer_initiated',
        eventData: {
          paymentIntentId: paymentIntent.id,
          amount,
          currency,
          referenceCode: bankTransferDetails.referenceCode,
          metadata,
          timestamp: new Date().toISOString(),
        },
      });

      // Record payment metrics
      await shoppingMetricsService.recordPaymentMetric(
        true,
        amount,
        'bank_transfer',
        processingTime
      );

      loggingService.info('Bank transfer initiated', {
        userId,
        paymentIntentId: paymentIntent.id,
        amount,
        referenceCode: bankTransferDetails.referenceCode,
        processingTime,
      });

      return {
        success: true,
        paymentIntent,
        bankTransferDetails,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Record failed payment metrics
      await shoppingMetricsService.recordPaymentMetric(
        false,
        params.amount,
        'bank_transfer',
        processingTime,
        errorMessage
      );

      loggingService.error('Failed to initiate bank transfer', {
        userId: params.userId,
        amount: params.amount,
        error: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Create bank transfer payment intent with Stripe (legacy method)
   * @param orderId - Order ID
   * @param amount - Amount in Japanese Yen
   * @deprecated Use initiateBankTransfer instead
   */
  async createBankTransferIntent(
    orderId: string,
    amount: number
  ): Promise<BankTransferInstructions> {
    try {
      const order = await orderRepository.findById(orderId);
      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      // Create payment intent for bank transfer
      const paymentIntent = await this.createPaymentIntent(orderId, amount);

      // In Japan, bank transfers are typically handled through konbini or bank_transfer payment methods
      // For now, we'll create instructions based on the payment intent
      const instructions: BankTransferInstructions = {
        paymentIntentId: paymentIntent.id,
        bankName: 'Stripe Bank Transfer',
        accountNumber: 'Generated by Stripe',
        accountName: 'Faxi Inc.',
        amount,
        referenceCode: order.referenceId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      // Log audit trail
      await auditLogService.log({
        userId: order.userId,
        eventType: 'payment.bank_transfer_intent_created',
        eventData: {
          orderId,
          paymentIntentId: paymentIntent.id,
          amount,
          referenceCode: order.referenceId,
          timestamp: new Date().toISOString(),
        },
      });

      loggingService.info('Bank transfer intent created', {
        orderId,
        paymentIntentId: paymentIntent.id,
        amount,
      });

      return instructions;
    } catch (error) {
      loggingService.error('Failed to create bank transfer intent', {
        orderId,
        amount,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Handle Stripe webhook for payment confirmation
   * @param event - Stripe webhook event
   */
  async handlePaymentWebhook(event: Stripe.Event): Promise<void> {
    try {
      loggingService.info('Processing Stripe webhook', {
        eventType: event.type,
        eventId: event.id,
      });

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.canceled':
          await this.handlePaymentCanceled(event.data.object as Stripe.PaymentIntent);
          break;

        default:
          loggingService.info('Unhandled webhook event type', {
            eventType: event.type,
          });
      }
    } catch (error) {
      loggingService.error('Failed to handle payment webhook', {
        eventType: event.type,
        eventId: event.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Handle successful payment
   */
  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) {
      loggingService.warn('Payment intent missing orderId in metadata', {
        paymentIntentId: paymentIntent.id,
      });
      return;
    }

    const order = await orderRepository.findById(orderId);
    if (!order) {
      loggingService.error('Order not found for payment intent', {
        orderId,
        paymentIntentId: paymentIntent.id,
      });
      return;
    }

    // Update order status to "paid"
    await orderRepository.updateStatus(orderId, 'paid');

    // Log audit trail
    await auditLogService.log({
      userId: order.userId,
      eventType: 'payment.succeeded',
      eventData: {
        orderId,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        status: 'paid',
        timestamp: new Date().toISOString(),
      },
    });

    loggingService.info('Payment succeeded, order status updated to paid', {
      orderId,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
    });
  }

  /**
   * Handle failed payment
   */
  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) {
      loggingService.warn('Payment intent missing orderId in metadata', {
        paymentIntentId: paymentIntent.id,
      });
      return;
    }

    const order = await orderRepository.findById(orderId);
    if (!order) {
      loggingService.error('Order not found for payment intent', {
        orderId,
        paymentIntentId: paymentIntent.id,
      });
      return;
    }

    // Log audit trail
    await auditLogService.log({
      userId: order.userId,
      eventType: 'payment.failed',
      eventData: {
        orderId,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        failureReason: paymentIntent.last_payment_error?.message,
        timestamp: new Date().toISOString(),
      },
    });

    loggingService.error('Payment failed', {
      orderId,
      paymentIntentId: paymentIntent.id,
      failureReason: paymentIntent.last_payment_error?.message,
    });

    // TODO: Send payment failure fax to user
  }

  /**
   * Handle canceled payment
   */
  private async handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const orderId = paymentIntent.metadata.orderId;
    if (!orderId) {
      loggingService.warn('Payment intent missing orderId in metadata', {
        paymentIntentId: paymentIntent.id,
      });
      return;
    }

    const order = await orderRepository.findById(orderId);
    if (!order) {
      loggingService.error('Order not found for payment intent', {
        orderId,
        paymentIntentId: paymentIntent.id,
      });
      return;
    }

    // Update order status to "cancelled"
    await orderRepository.updateStatus(orderId, 'cancelled');

    // Log audit trail
    await auditLogService.log({
      userId: order.userId,
      eventType: 'payment.canceled',
      eventData: {
        orderId,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        timestamp: new Date().toISOString(),
      },
    });

    loggingService.info('Payment canceled, order status updated to cancelled', {
      orderId,
      paymentIntentId: paymentIntent.id,
    });
  }

  /**
   * Verify Stripe webhook signature
   * @param payload - Raw webhook payload
   * @param signature - Stripe signature header
   */
  verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      loggingService.error('Webhook signature verification failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Invalid webhook signature');
    }
  }
}

export const paymentService = new PaymentService();
