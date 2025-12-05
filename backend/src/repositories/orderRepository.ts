import { db } from '../database/connection';

export interface Order {
  id: string;
  userId: string;
  referenceId: string;
  externalOrderId: string | null;
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'pending_payment' | 'pending_purchase' | 'purchased';
  totalAmount: number;
  currency: string;
  items: any;
  shippingAddress: any;
  trackingNumber: string | null;
  // Shopping-specific fields
  productAsin?: string | null;
  productTitle?: string | null;
  productImageUrl?: string | null;
  quantity?: number;
  quotedPrice?: number | null;
  actualPrice?: number | null;
  stripePaymentIntentId?: string | null;
  adminUserId?: string | null;
  purchasedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderData {
  userId: string;
  referenceId: string;
  externalOrderId?: string;
  status?: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'pending_payment' | 'pending_purchase' | 'purchased';
  totalAmount: number;
  currency?: string;
  items: any;
  shippingAddress?: any;
  trackingNumber?: string;
  // Shopping-specific fields
  productAsin?: string;
  productTitle?: string;
  productImageUrl?: string;
  quantity?: number;
  quotedPrice?: number;
  actualPrice?: number;
  stripePaymentIntentId?: string;
  adminUserId?: string;
  purchasedAt?: Date;
}

export interface UpdateOrderData {
  externalOrderId?: string;
  status?: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'pending_payment' | 'pending_purchase' | 'purchased';
  trackingNumber?: string;
  shippingAddress?: any;
  stripePaymentIntentId?: string;
  // Shopping-specific fields
  actualPrice?: number;
  adminUserId?: string;
  purchasedAt?: Date;
}

export class OrderRepository {
  /**
   * Find order by ID
   */
  async findById(id: string): Promise<Order | null> {
    const result = await db.query<Order>(
      `SELECT id, user_id as "userId", reference_id as "referenceId",
              external_order_id as "externalOrderId", status, total_amount as "totalAmount",
              currency, items, shipping_address as "shippingAddress",
              tracking_number as "trackingNumber",
              product_asin as "productAsin", product_title as "productTitle",
              product_image_url as "productImageUrl", quantity,
              quoted_price as "quotedPrice", actual_price as "actualPrice",
              stripe_payment_intent_id as "stripePaymentIntentId",
              admin_user_id as "adminUserId", purchased_at as "purchasedAt",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM orders 
       WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Find order by external order ID (from e-commerce platform)
   */
  async findByExternalOrderId(externalOrderId: string): Promise<Order | null> {
    const result = await db.query<Order>(
      `SELECT id, user_id as "userId", reference_id as "referenceId",
              external_order_id as "externalOrderId", status, total_amount as "totalAmount",
              currency, items, shipping_address as "shippingAddress",
              tracking_number as "trackingNumber",
              product_asin as "productAsin", product_title as "productTitle",
              product_image_url as "productImageUrl", quantity,
              quoted_price as "quotedPrice", actual_price as "actualPrice",
              stripe_payment_intent_id as "stripePaymentIntentId",
              admin_user_id as "adminUserId", purchased_at as "purchasedAt",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM orders 
       WHERE external_order_id = $1`,
      [externalOrderId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find order by reference ID
   */
  async findByReferenceId(referenceId: string): Promise<Order | null> {
    const result = await db.query<Order>(
      `SELECT id, user_id as "userId", reference_id as "referenceId",
              external_order_id as "externalOrderId", status, total_amount as "totalAmount",
              currency, items, shipping_address as "shippingAddress",
              tracking_number as "trackingNumber",
              product_asin as "productAsin", product_title as "productTitle",
              product_image_url as "productImageUrl", quantity,
              quoted_price as "quotedPrice", actual_price as "actualPrice",
              stripe_payment_intent_id as "stripePaymentIntentId",
              admin_user_id as "adminUserId", purchased_at as "purchasedAt",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM orders
       WHERE reference_id = $1`,
      [referenceId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find order by Stripe payment intent ID
   */
  async findByStripePaymentIntentId(paymentIntentId: string): Promise<Order | null> {
    const result = await db.query<Order>(
      `SELECT id, user_id as "userId", reference_id as "referenceId",
              external_order_id as "externalOrderId", status, total_amount as "totalAmount",
              currency, items, shipping_address as "shippingAddress",
              tracking_number as "trackingNumber",
              product_asin as "productAsin", product_title as "productTitle",
              product_image_url as "productImageUrl", quantity,
              quoted_price as "quotedPrice", actual_price as "actualPrice",
              stripe_payment_intent_id as "stripePaymentIntentId",
              admin_user_id as "adminUserId", purchased_at as "purchasedAt",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM orders
       WHERE stripe_payment_intent_id = $1`,
      [paymentIntentId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find order history for a user
   */
  async findByUserId(userId: string, limit: number = 50): Promise<Order[]> {
    const result = await db.query<Order>(
      `SELECT id, user_id as "userId", reference_id as "referenceId",
              external_order_id as "externalOrderId", status, total_amount as "totalAmount",
              currency, items, shipping_address as "shippingAddress",
              tracking_number as "trackingNumber",
              product_asin as "productAsin", product_title as "productTitle",
              product_image_url as "productImageUrl", quantity,
              quoted_price as "quotedPrice", actual_price as "actualPrice",
              stripe_payment_intent_id as "stripePaymentIntentId",
              admin_user_id as "adminUserId", purchased_at as "purchasedAt",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM orders 
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  /**
   * Find orders by status
   */
  async findByStatus(
    status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'pending_payment' | 'pending_purchase' | 'purchased',
    limit: number = 100
  ): Promise<Order[]> {
    const result = await db.query<Order>(
      `SELECT id, user_id as "userId", reference_id as "referenceId",
              external_order_id as "externalOrderId", status, total_amount as "totalAmount",
              currency, items, shipping_address as "shippingAddress",
              tracking_number as "trackingNumber",
              product_asin as "productAsin", product_title as "productTitle",
              product_image_url as "productImageUrl", quantity,
              quoted_price as "quotedPrice", actual_price as "actualPrice",
              stripe_payment_intent_id as "stripePaymentIntentId",
              admin_user_id as "adminUserId", purchased_at as "purchasedAt",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM orders 
       WHERE status = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [status, limit]
    );

    return result.rows;
  }

  /**
   * Create a new order
   */
  async create(data: CreateOrderData): Promise<Order> {
    const result = await db.query<Order>(
      `INSERT INTO orders (
        user_id, reference_id, external_order_id, status, total_amount,
        currency, items, shipping_address, tracking_number,
        product_asin, product_title, product_image_url, quantity,
        quoted_price, actual_price, stripe_payment_intent_id,
        admin_user_id, purchased_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING id, user_id as "userId", reference_id as "referenceId",
                 external_order_id as "externalOrderId", status, total_amount as "totalAmount",
                 currency, items, shipping_address as "shippingAddress",
                 tracking_number as "trackingNumber",
                 product_asin as "productAsin", product_title as "productTitle",
                 product_image_url as "productImageUrl", quantity,
                 quoted_price as "quotedPrice", actual_price as "actualPrice",
                 stripe_payment_intent_id as "stripePaymentIntentId",
                 admin_user_id as "adminUserId", purchased_at as "purchasedAt",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        data.userId,
        data.referenceId,
        data.externalOrderId || null,
        data.status || 'pending',
        data.totalAmount,
        data.currency || 'JPY',
        JSON.stringify(data.items),
        data.shippingAddress ? JSON.stringify(data.shippingAddress) : null,
        data.trackingNumber || null,
        data.productAsin || null,
        data.productTitle || null,
        data.productImageUrl || null,
        data.quantity || 1,
        data.quotedPrice || null,
        data.actualPrice || null,
        data.stripePaymentIntentId || null,
        data.adminUserId || null,
        data.purchasedAt || null,
      ]
    );

    return result.rows[0];
  }

  /**
   * Update order
   */
  async update(id: string, data: UpdateOrderData): Promise<Order> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.externalOrderId !== undefined) {
      updates.push(`external_order_id = $${paramIndex++}`);
      values.push(data.externalOrderId);
    }

    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }

    if (data.trackingNumber !== undefined) {
      updates.push(`tracking_number = $${paramIndex++}`);
      values.push(data.trackingNumber);
    }

    if (data.shippingAddress !== undefined) {
      updates.push(`shipping_address = $${paramIndex++}`);
      values.push(JSON.stringify(data.shippingAddress));
    }

    if (data.stripePaymentIntentId !== undefined) {
      updates.push(`stripe_payment_intent_id = $${paramIndex++}`);
      values.push(data.stripePaymentIntentId);
    }

    if (data.actualPrice !== undefined) {
      updates.push(`actual_price = $${paramIndex++}`);
      values.push(data.actualPrice);
    }

    if (data.adminUserId !== undefined) {
      updates.push(`admin_user_id = $${paramIndex++}`);
      values.push(data.adminUserId);
    }

    if (data.purchasedAt !== undefined) {
      updates.push(`purchased_at = $${paramIndex++}`);
      values.push(data.purchasedAt);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);

    const result = await db.query<Order>(
      `UPDATE orders 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, user_id as "userId", reference_id as "referenceId",
                 external_order_id as "externalOrderId", status, total_amount as "totalAmount",
                 currency, items, shipping_address as "shippingAddress",
                 tracking_number as "trackingNumber",
                 product_asin as "productAsin", product_title as "productTitle",
                 product_image_url as "productImageUrl", quantity,
                 quoted_price as "quotedPrice", actual_price as "actualPrice",
                 stripe_payment_intent_id as "stripePaymentIntentId",
                 admin_user_id as "adminUserId", purchased_at as "purchasedAt",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      values
    );

    return result.rows[0];
  }

  /**
   * Update order status
   */
  async updateStatus(
    id: string,
    status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'pending_payment' | 'pending_purchase' | 'purchased'
  ): Promise<Order> {
    return await this.update(id, { status });
  }

  /**
   * Update tracking number
   */
  async updateTracking(id: string, trackingNumber: string): Promise<Order> {
    return await this.update(id, { trackingNumber });
  }

  /**
   * Find all orders with optional status filter
   */
  async findAll(options: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ orders: Order[]; total: number }> {
    const { status, limit = 50, offset = 0 } = options;

    let whereClause = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      whereClause = `WHERE status = $${paramIndex++}`;
      params.push(status);
    }

    // Get total count
    const countResult = await db.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM orders ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results
    params.push(limit, offset);
    const result = await db.query<Order>(
      `SELECT id, user_id as "userId", reference_id as "referenceId",
              external_order_id as "externalOrderId", status, total_amount as "totalAmount",
              currency, items, shipping_address as "shippingAddress",
              tracking_number as "trackingNumber",
              product_asin as "productAsin", product_title as "productTitle",
              product_image_url as "productImageUrl", quantity,
              quoted_price as "quotedPrice", actual_price as "actualPrice",
              stripe_payment_intent_id as "stripePaymentIntentId",
              admin_user_id as "adminUserId", purchased_at as "purchasedAt",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM orders
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      params
    );

    return { orders: result.rows, total };
  }
}

export const orderRepository = new OrderRepository();
