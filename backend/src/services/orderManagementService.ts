import { orderRepository, Order } from '../repositories/orderRepository';
import { userRepository } from '../repositories/userRepository';
import { auditLogService } from './auditLogService';
import { loggingService } from './loggingService';
import { shoppingMetricsService } from './shoppingMetricsService';

/**
 * Order status type for shopping orders
 */
export type OrderStatus =
  | 'pending_payment'   // Awaiting payment
  | 'paid'              // Payment confirmed
  | 'pending_purchase'  // Ready for admin review
  | 'purchased'         // Bought on Amazon
  | 'shipped'           // Tracking number added
  | 'delivered'         // Delivery confirmed
  | 'cancelled';        // Order cancelled

/**
 * Extended order interface with shopping-specific fields
 */
export interface ShoppingOrder extends Order {
  productAsin: string | null;
  productTitle: string | null;
  productImageUrl: string | null;
  quantity: number;
  quotedPrice: number | null;
  actualPrice: number | null;
  stripePaymentIntentId: string | null;
  adminUserId: string | null;
  purchasedAt: Date | null;
}

/**
 * Data for creating a new shopping order
 */
export interface CreateOrderData {
  userId: string;
  referenceId: string;
  productAsin: string;
  productTitle: string;
  productImageUrl?: string;
  quantity: number;
  quotedPrice: number;
  shippingAddress: any;
  stripePaymentIntentId?: string;
}

/**
 * Order validation result
 */
export interface OrderValidation {
  valid: boolean;
  currentPrice: number | null;
  priceDifference: number;
  inStock: boolean;
  requiresApproval: boolean;
  warnings: string[];
}

/**
 * Admin order view with additional context
 */
export interface AdminOrderView {
  order: ShoppingOrder;
  user: {
    id: string;
    name: string | null;
    phoneNumber: string;
  };
  faxImage: {
    storageKey: string | null;
    thumbnailUrl: string | null;
  };
  paymentStatus: {
    method: 'card' | 'bank_transfer';
    stripePaymentIntentId: string | null;
    status: 'pending' | 'succeeded' | 'failed';
    paidAt: Date | null;
  };
  priceValidation: {
    quotedPrice: number;
    currentPrice: number | null;
    discrepancy: number;
    requiresApproval: boolean;
  };
  stockStatus: {
    available: boolean;
    checkedAt: Date;
  };
}

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
 * Order Management Service
 * Handles order lifecycle from creation to delivery
 */
export class OrderManagementService {
  /**
   * Create a new shopping order with initial state "pending_payment"
   */
  async createOrder(data: CreateOrderData): Promise<ShoppingOrder> {
    loggingService.info('Creating new shopping order', {
      userId: data.userId,
      productAsin: data.productAsin,
      quotedPrice: data.quotedPrice
    });

    // Verify user exists
    const user = await userRepository.findById(data.userId);
    if (!user) {
      throw new Error(`User not found: ${data.userId}`);
    }

    // Create order with initial status "pending_payment"
    const order = await orderRepository.create({
      userId: data.userId,
      referenceId: data.referenceId,
      status: 'pending_payment',
      totalAmount: data.quotedPrice,
      currency: 'JPY',
      items: [{
        asin: data.productAsin,
        title: data.productTitle,
        price: data.quotedPrice,
        quantity: data.quantity,
        imageUrl: data.productImageUrl || null
      }],
      shippingAddress: data.shippingAddress,
      productAsin: data.productAsin,
      productTitle: data.productTitle,
      productImageUrl: data.productImageUrl,
      quantity: data.quantity,
      quotedPrice: data.quotedPrice,
      stripePaymentIntentId: data.stripePaymentIntentId
    });

    // Log order creation
    await auditLogService.log({
      userId: data.userId,
      eventType: 'order_created',
      eventData: {
        orderId: order.id,
        referenceId: data.referenceId,
        productAsin: data.productAsin,
        quotedPrice: data.quotedPrice,
        status: 'pending_payment'
      }
    });

    loggingService.info('Shopping order created successfully', {
      orderId: order.id,
      referenceId: data.referenceId
    });

    return order as ShoppingOrder;
  }

  /**
   * Update order status with state machine validation
   */
  async updateOrderStatus(
    orderId: string,
    newStatus: OrderStatus,
    metadata?: Record<string, any>
  ): Promise<ShoppingOrder> {
    loggingService.info('Updating order status', {
      orderId,
      newStatus,
      metadata
    });

    // Get current order
    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const currentStatus = order.status as OrderStatus;

    // Validate state transition
    const validTransitions = VALID_TRANSITIONS[currentStatus];
    if (!validTransitions.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from ${currentStatus} to ${newStatus}`
      );
    }

    // Update order status
    const updatedOrder = await orderRepository.updateStatus(orderId, newStatus);

    // Log status change
    await auditLogService.log({
      userId: order.userId,
      eventType: 'order_status_changed',
      eventData: {
        orderId,
        previousStatus: currentStatus,
        newStatus,
        metadata: metadata || {}
      }
    });

    // Record order metrics
    await shoppingMetricsService.recordOrderMetric(
      orderId,
      newStatus,
      currentStatus,
      order.totalAmount
    );

    loggingService.info('Order status updated successfully', {
      orderId,
      previousStatus: currentStatus,
      newStatus
    });

    return updatedOrder as ShoppingOrder;
  }

  /**
   * Get order by reference ID
   */
  async getOrderByReferenceId(referenceId: string): Promise<ShoppingOrder | null> {
    loggingService.debug('Fetching order by reference ID', { referenceId });

    const order = await orderRepository.findByReferenceId(referenceId);
    return order as ShoppingOrder | null;
  }

  /**
   * Get pending purchase orders for admin queue
   * Returns orders with status "paid" ready for admin review
   */
  async getPendingPurchaseOrders(): Promise<AdminOrderView[]> {
    loggingService.debug('Fetching pending purchase orders');

    const orders = await orderRepository.findByStatus('paid');

    // Build admin order views
    const adminViews: AdminOrderView[] = [];

    for (const order of orders) {
      const user = await userRepository.findById(order.userId);
      if (!user) {
        loggingService.warn('User not found for order', {
          orderId: order.id,
          userId: order.userId
        });
        continue;
      }

      // TODO: Fetch fax image from storage
      // TODO: Fetch payment status from Stripe
      // TODO: Validate current price from PA-API

      const adminView: AdminOrderView = {
        order: order as ShoppingOrder,
        user: {
          id: user.id,
          name: user.name,
          phoneNumber: user.phoneNumber
        },
        faxImage: {
          storageKey: null,
          thumbnailUrl: null
        },
        paymentStatus: {
          method: 'card', // TODO: Determine from payment method
          stripePaymentIntentId: (order as any).stripePaymentIntentId || null,
          status: 'succeeded', // TODO: Fetch from Stripe
          paidAt: null
        },
        priceValidation: {
          quotedPrice: (order as any).quotedPrice || order.totalAmount,
          currentPrice: null, // TODO: Fetch from PA-API
          discrepancy: 0,
          requiresApproval: false
        },
        stockStatus: {
          available: true, // TODO: Check with PA-API
          checkedAt: new Date()
        }
      };

      adminViews.push(adminView);
    }

    loggingService.info('Fetched pending purchase orders', {
      count: adminViews.length
    });

    return adminViews;
  }

  /**
   * Get orders awaiting customer payment (status = "pending_payment")
   * These are orders created but not yet paid via bank transfer
   */
  async getOrdersAwaitingPayment(): Promise<AdminOrderView[]> {
    loggingService.debug('Fetching orders awaiting payment');

    const orders = await orderRepository.findByStatus('pending_payment');

    const adminViews: AdminOrderView[] = [];

    for (const order of orders) {
      const user = await userRepository.findById(order.userId);
      if (!user) {
        loggingService.warn('User not found for order', {
          orderId: order.id,
          userId: order.userId
        });
        continue;
      }

      const adminView: AdminOrderView = {
        order: order as ShoppingOrder,
        user: {
          id: user.id,
          name: user.name,
          phoneNumber: user.phoneNumber
        },
        faxImage: {
          storageKey: null,
          thumbnailUrl: null
        },
        paymentStatus: {
          method: 'bank_transfer',
          stripePaymentIntentId: (order as any).stripePaymentIntentId || null,
          status: 'pending',  // pending = awaiting payment
          paidAt: null
        },
        priceValidation: {
          quotedPrice: (order as any).quotedPrice || order.totalAmount,
          currentPrice: null,
          discrepancy: 0,
          requiresApproval: false
        },
        stockStatus: {
          available: true,
          checkedAt: new Date()
        }
      };

      adminViews.push(adminView);
    }

    loggingService.info('Fetched orders awaiting payment', {
      count: adminViews.length
    });

    return adminViews;
  }

  /**
   * Validate order before purchase
   * Checks current price and stock availability
   */
  async validateOrderForPurchase(orderId: string): Promise<OrderValidation> {
    loggingService.debug('Validating order for purchase', { orderId });

    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    // TODO: Implement actual price and stock validation with PA-API
    // For now, return a placeholder validation
    const validation: OrderValidation = {
      valid: true,
      currentPrice: (order as any).quotedPrice || order.totalAmount,
      priceDifference: 0,
      inStock: true,
      requiresApproval: false,
      warnings: []
    };

    // Check if price difference exceeds threshold (50 JPY)
    const quotedPrice = (order as any).quotedPrice || order.totalAmount;
    const currentPrice = validation.currentPrice || quotedPrice;
    const priceDifference = Math.abs(currentPrice - quotedPrice);

    if (priceDifference > 50) {
      validation.requiresApproval = true;
      validation.warnings.push(
        `Price difference of ¥${priceDifference} exceeds threshold`
      );
    }

    if (!validation.inStock) {
      validation.valid = false;
      validation.warnings.push('Product is out of stock');
    }

    loggingService.info('Order validation completed', {
      orderId,
      valid: validation.valid,
      requiresApproval: validation.requiresApproval
    });

    return validation;
  }

  /**
   * Complete purchase and capture Amazon Order ID
   */
  async completePurchase(
    orderId: string,
    amazonOrderId: string,
    actualPrice: number,
    adminUserId?: string
  ): Promise<ShoppingOrder> {
    loggingService.info('Completing purchase', {
      orderId,
      amazonOrderId,
      actualPrice,
      adminUserId
    });

    const order = await orderRepository.findById(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    // Verify order is in correct state
    if (order.status !== 'paid' && order.status !== 'pending_purchase') {
      throw new Error(
        `Cannot complete purchase for order in status: ${order.status}`
      );
    }

    // Update order with purchase details
    const updatedOrder = await orderRepository.update(orderId, {
      externalOrderId: amazonOrderId,
      status: 'purchased',
      actualPrice,
      adminUserId,
      purchasedAt: new Date()
    });

    // Log purchase completion
    await auditLogService.log({
      userId: order.userId,
      eventType: 'admin_purchase_completed',
      eventData: {
        orderId,
        amazonOrderId,
        actualPrice,
        quotedPrice: (order as any).quotedPrice || order.totalAmount,
        adminUserId: adminUserId || null,
        purchasedAt: new Date().toISOString()
      }
    });

    loggingService.info('Purchase completed successfully', {
      orderId,
      amazonOrderId
    });

    return updatedOrder as ShoppingOrder;
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<ShoppingOrder | null> {
    const order = await orderRepository.findById(orderId);
    return order as ShoppingOrder | null;
  }

  /**
   * List orders for a user
   */
  async listUserOrders(userId: string, limit: number = 50): Promise<ShoppingOrder[]> {
    const orders = await orderRepository.findByUserId(userId, limit);
    return orders as ShoppingOrder[];
  }
}

export const orderManagementService = new OrderManagementService();
