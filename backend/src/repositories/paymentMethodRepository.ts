import { db } from '../database/connection';

export interface PaymentMethod {
  id: string;
  userId: string;
  stripePaymentMethodId: string;
  type: 'card' | 'konbini' | 'bank_transfer';
  last4: string | null;
  brand: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentMethodData {
  userId: string;
  stripePaymentMethodId: string;
  type: 'card' | 'konbini' | 'bank_transfer';
  last4?: string;
  brand?: string;
  isDefault?: boolean;
}

export interface UpdatePaymentMethodData {
  isDefault?: boolean;
}

export class PaymentMethodRepository {
  /**
   * Find payment method by ID
   */
  async findById(id: string): Promise<PaymentMethod | null> {
    const result = await db.query<PaymentMethod>(
      `SELECT id, user_id as "userId", stripe_payment_method_id as "stripePaymentMethodId",
              type, last4, brand, is_default as "isDefault",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM payment_methods 
       WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Find payment method by Stripe payment method ID
   */
  async findByStripeId(stripePaymentMethodId: string): Promise<PaymentMethod | null> {
    const result = await db.query<PaymentMethod>(
      `SELECT id, user_id as "userId", stripe_payment_method_id as "stripePaymentMethodId",
              type, last4, brand, is_default as "isDefault",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM payment_methods 
       WHERE stripe_payment_method_id = $1`,
      [stripePaymentMethodId]
    );

    return result.rows[0] || null;
  }

  /**
   * Find all payment methods for a user
   */
  async findByUserId(userId: string): Promise<PaymentMethod[]> {
    const result = await db.query<PaymentMethod>(
      `SELECT id, user_id as "userId", stripe_payment_method_id as "stripePaymentMethodId",
              type, last4, brand, is_default as "isDefault",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM payment_methods 
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Find default payment method for a user
   */
  async findDefaultByUserId(userId: string): Promise<PaymentMethod | null> {
    const result = await db.query<PaymentMethod>(
      `SELECT id, user_id as "userId", stripe_payment_method_id as "stripePaymentMethodId",
              type, last4, brand, is_default as "isDefault",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM payment_methods 
       WHERE user_id = $1 AND is_default = true
       LIMIT 1`,
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Create a new payment method
   */
  async create(data: CreatePaymentMethodData): Promise<PaymentMethod> {
    // If this is being set as default, unset other defaults first
    if (data.isDefault) {
      await this.unsetAllDefaults(data.userId);
    }

    const result = await db.query<PaymentMethod>(
      `INSERT INTO payment_methods (
        user_id, stripe_payment_method_id, type, last4, brand, is_default
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id as "userId", stripe_payment_method_id as "stripePaymentMethodId",
                 type, last4, brand, is_default as "isDefault",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        data.userId,
        data.stripePaymentMethodId,
        data.type,
        data.last4 || null,
        data.brand || null,
        data.isDefault || false,
      ]
    );

    return result.rows[0];
  }

  /**
   * Update payment method
   */
  async update(id: string, data: UpdatePaymentMethodData): Promise<PaymentMethod> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.isDefault !== undefined) {
      updates.push(`is_default = $${paramIndex++}`);
      values.push(data.isDefault);

      // If setting as default, unset other defaults first
      if (data.isDefault) {
        const paymentMethod = await this.findById(id);
        if (paymentMethod) {
          await this.unsetAllDefaults(paymentMethod.userId);
        }
      }
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);

    const result = await db.query<PaymentMethod>(
      `UPDATE payment_methods 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, user_id as "userId", stripe_payment_method_id as "stripePaymentMethodId",
                 type, last4, brand, is_default as "isDefault",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      values
    );

    return result.rows[0];
  }

  /**
   * Set a payment method as default
   */
  async setAsDefault(id: string): Promise<PaymentMethod> {
    return await this.update(id, { isDefault: true });
  }

  /**
   * Unset all default payment methods for a user
   */
  async unsetAllDefaults(userId: string): Promise<void> {
    await db.query(
      `UPDATE payment_methods 
       SET is_default = false 
       WHERE user_id = $1`,
      [userId]
    );
  }

  /**
   * Delete payment method
   */
  async delete(id: string): Promise<void> {
    await db.query(`DELETE FROM payment_methods WHERE id = $1`, [id]);
  }
}

export const paymentMethodRepository = new PaymentMethodRepository();
