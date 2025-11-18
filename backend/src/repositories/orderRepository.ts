import { db } from '../database/connection';

export interface Order {
  id: string;
  userId: string;
  referenceId: string;
  externalOrderId: string | null;
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  currency: string;
  items: any;
  shippingAddress: any;
  trackingNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrderData {
  userId: string;
  referenceId: string;
  externalOrderId?: string;
  status?: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  currency?: string;
  items: any;
  shippingAddress?: any;
  trackingNumber?: string;
}

export interface UpdateOrderData {
  externalOrderId?: string;
  status?: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  trackingNumber?: string;
  shippingAddress?: any;
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
              tracking_number as "trackingNumber", created_at as "createdAt", 
              updated_at as "updatedAt"
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
              tracking_number as "trackingNumber", created_at as "createdAt", 
              updated_at as "updatedAt"
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
              tracking_number as "trackingNumber", created_at as "createdAt", 
              updated_at as "updatedAt"
       FROM orders 
       WHERE reference_id = $1`,
      [referenceId]
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
              tracking_number as "trackingNumber", created_at as "createdAt", 
              updated_at as "updatedAt"
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
    status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled',
    limit: number = 100
  ): Promise<Order[]> {
    const result = await db.query<Order>(
      `SELECT id, user_id as "userId", reference_id as "referenceId",
              external_order_id as "externalOrderId", status, total_amount as "totalAmount",
              currency, items, shipping_address as "shippingAddress",
              tracking_number as "trackingNumber", created_at as "createdAt", 
              updated_at as "updatedAt"
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
        currency, items, shipping_address, tracking_number
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, user_id as "userId", reference_id as "referenceId",
                 external_order_id as "externalOrderId", status, total_amount as "totalAmount",
                 currency, items, shipping_address as "shippingAddress",
                 tracking_number as "trackingNumber", created_at as "createdAt", 
                 updated_at as "updatedAt"`,
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
                 tracking_number as "trackingNumber", created_at as "createdAt", 
                 updated_at as "updatedAt"`,
      values
    );

    return result.rows[0];
  }

  /**
   * Update order status
   */
  async updateStatus(
    id: string,
    status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  ): Promise<Order> {
    return await this.update(id, { status });
  }

  /**
   * Update tracking number
   */
  async updateTracking(id: string, trackingNumber: string): Promise<Order> {
    return await this.update(id, { trackingNumber });
  }
}

export const orderRepository = new OrderRepository();
