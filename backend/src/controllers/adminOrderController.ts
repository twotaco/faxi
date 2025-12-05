import { Request, Response } from 'express';
import { orderManagementService } from '../services/orderManagementService';
import { browserAutomationService } from '../services/browserAutomationService';
import { loggingService } from '../services/loggingService';
import { auditLogService } from '../services/auditLogService';
import { orderRepository } from '../repositories/orderRepository';
import { userRepository } from '../repositories/userRepository';

/**
 * Admin Order Controller
 * Handles admin dashboard endpoints for order review and fulfillment
 */

/**
 * GET /api/admin/orders
 * Returns list of all orders with optional status filter
 */
export async function getAllOrders(req: Request, res: Response): Promise<void> {
  try {
    const { status, limit = '50', offset = '0' } = req.query;

    loggingService.info('Admin fetching all orders', {
      adminUserId: (req as any).adminUser?.id,
      status: status || 'all',
      limit,
      offset
    });

    const result = await orderRepository.findAll({
      status: status as string | undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10)
    });

    // Enrich orders with user info
    const enrichedOrders = await Promise.all(
      result.orders.map(async (order) => {
        const user = await userRepository.findById(order.userId);

        // Fallback to items.products[0] for older orders that don't have top-level product fields
        const items = order.items as any;
        const firstProduct = items?.products?.[0];

        return {
          order: {
            id: order.id,
            referenceId: order.referenceId,
            externalOrderId: order.externalOrderId,
            status: order.status,
            totalAmount: order.totalAmount,
            currency: order.currency,
            productAsin: order.productAsin || firstProduct?.asin || null,
            productTitle: order.productTitle || firstProduct?.title || null,
            productImageUrl: order.productImageUrl || firstProduct?.imageUrl || null,
            quantity: order.quantity || firstProduct?.quantity || 1,
            quotedPrice: order.quotedPrice || firstProduct?.price || null,
            actualPrice: order.actualPrice,
            trackingNumber: order.trackingNumber,
            stripePaymentIntentId: order.stripePaymentIntentId,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            purchasedAt: order.purchasedAt
          },
          user: user ? {
            id: user.id,
            name: user.name,
            phoneNumber: user.phoneNumber
          } : null
        };
      })
    );

    res.json({
      success: true,
      data: {
        orders: enrichedOrders,
        total: result.total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10)
      }
    });
  } catch (error) {
    loggingService.error('Error fetching all orders', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders'
    });
  }
}

/**
 * GET /api/admin/orders/pending
 * Returns list of orders ready for purchase (status = "paid")
 */
export async function getPendingOrders(req: Request, res: Response): Promise<void> {
  try {
    loggingService.info('Admin fetching pending orders', {
      adminUserId: (req as any).adminUser?.id
    });

    const orders = await orderManagementService.getPendingPurchaseOrders();

    res.json({
      success: true,
      data: {
        orders,
        count: orders.length
      }
    });
  } catch (error) {
    loggingService.error('Error fetching pending orders', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending orders'
    });
  }
}

/**
 * GET /api/admin/orders/awaiting-payment
 * Returns list of orders waiting for customer payment (status = "pending_payment")
 */
export async function getOrdersAwaitingPayment(req: Request, res: Response): Promise<void> {
  try {
    loggingService.info('Admin fetching orders awaiting payment', {
      adminUserId: (req as any).adminUser?.id
    });

    const orders = await orderManagementService.getOrdersAwaitingPayment();

    res.json({
      success: true,
      data: {
        orders,
        count: orders.length
      }
    });
  } catch (error) {
    loggingService.error('Error fetching orders awaiting payment', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch orders awaiting payment'
    });
  }
}

/**
 * GET /api/admin/orders/:id
 * Returns detailed order view with fax image and validation
 */
export async function getOrderDetails(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    loggingService.info('Admin fetching order details', {
      orderId: id,
      adminUserId: (req as any).adminUser?.id
    });

    const order = await orderManagementService.getOrderById(id);

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'Order not found'
      });
      return;
    }

    // Get validation data
    const validation = await orderManagementService.validateOrderForPurchase(id);

    res.json({
      success: true,
      data: {
        order,
        validation
      }
    });
  } catch (error) {
    loggingService.error('Error fetching order details', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch order details'
    });
  }
}

/**
 * POST /api/admin/orders/:id/prepare-checkout
 * Triggers browser automation to prepare Amazon checkout
 */
export async function prepareCheckout(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const adminUserId = (req as any).adminUser?.id;

    loggingService.info('Admin preparing checkout', {
      orderId: id,
      adminUserId
    });

    const order = await orderManagementService.getOrderById(id);

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'Order not found'
      });
      return;
    }

    if (order.status !== 'paid' && order.status !== 'pending_purchase') {
      res.status(400).json({
        success: false,
        error: `Cannot prepare checkout for order in status: ${order.status}`
      });
      return;
    }

    // Trigger browser automation
    const checkoutSession = await browserAutomationService.prepareCheckout(order);

    // Update order status to pending_purchase
    if (order.status === 'paid') {
      await orderManagementService.updateOrderStatus(id, 'pending_purchase', {
        checkoutPreparedBy: adminUserId,
        checkoutPreparedAt: new Date().toISOString()
      });
    }

    // Log admin action
    await auditLogService.log({
      userId: order.userId,
      eventType: 'admin_checkout_prepared',
      eventData: {
        orderId: id,
        adminUserId,
        checkoutSessionId: checkoutSession.sessionId
      }
    });

    res.json({
      success: true,
      data: {
        checkoutSession
      }
    });
  } catch (error) {
    loggingService.error('Error preparing checkout', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to prepare checkout'
    });
  }
}

/**
 * POST /api/admin/orders/:id/complete-purchase
 * Records Amazon order ID and completes purchase
 */
export async function completePurchase(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { amazonOrderId, actualPrice } = req.body;
    const adminUserId = (req as any).adminUser?.id;

    if (!amazonOrderId) {
      res.status(400).json({
        success: false,
        error: 'Amazon Order ID is required'
      });
      return;
    }

    if (!actualPrice || typeof actualPrice !== 'number') {
      res.status(400).json({
        success: false,
        error: 'Actual price is required and must be a number'
      });
      return;
    }

    loggingService.info('Admin completing purchase', {
      orderId: id,
      amazonOrderId,
      actualPrice,
      adminUserId
    });

    const order = await orderManagementService.completePurchase(
      id,
      amazonOrderId,
      actualPrice,
      adminUserId
    );

    res.json({
      success: true,
      data: {
        order
      }
    });
  } catch (error) {
    loggingService.error('Error completing purchase', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete purchase'
    });
  }
}

/**
 * POST /api/admin/orders/:id/cancel
 * Cancels order and refunds payment
 */
export async function cancelOrder(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminUserId = (req as any).adminUser?.id;

    loggingService.info('Admin cancelling order', {
      orderId: id,
      reason,
      adminUserId
    });

    const order = await orderManagementService.getOrderById(id);

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'Order not found'
      });
      return;
    }

    // Update order status to cancelled
    const cancelledOrder = await orderManagementService.updateOrderStatus(id, 'cancelled', {
      cancelledBy: adminUserId,
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason
    });

    // Log cancellation
    await auditLogService.log({
      userId: order.userId,
      eventType: 'admin_order_cancelled',
      eventData: {
        orderId: id,
        adminUserId,
        reason,
        previousStatus: order.status
      }
    });

    // TODO: Trigger refund via Stripe if payment was processed

    res.json({
      success: true,
      data: {
        order: cancelledOrder
      }
    });
  } catch (error) {
    loggingService.error('Error cancelling order', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel order'
    });
  }
}

/**
 * POST /api/admin/orders/:id/update-tracking
 * Updates tracking number and transitions to shipped status
 */
export async function updateTracking(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { trackingNumber } = req.body;
    const adminUserId = (req as any).adminUser?.id;

    if (!trackingNumber) {
      res.status(400).json({
        success: false,
        error: 'Tracking number is required'
      });
      return;
    }

    loggingService.info('Admin updating tracking number', {
      orderId: id,
      trackingNumber,
      adminUserId
    });

    const order = await orderManagementService.getOrderById(id);

    if (!order) {
      res.status(404).json({
        success: false,
        error: 'Order not found'
      });
      return;
    }

    // Update order with tracking number and status
    const updatedOrder = await orderManagementService.updateOrderStatus(id, 'shipped', {
      trackingNumber,
      shippedBy: adminUserId,
      shippedAt: new Date().toISOString()
    });

    // Log tracking update
    await auditLogService.log({
      userId: order.userId,
      eventType: 'tracking_number_added',
      eventData: {
        orderId: id,
        trackingNumber,
        adminUserId
      }
    });

    res.json({
      success: true,
      data: {
        order: updatedOrder
      }
    });
  } catch (error) {
    loggingService.error('Error updating tracking number', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update tracking number'
    });
  }
}
