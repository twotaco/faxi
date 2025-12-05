import { db } from '../database/connection';
import { config } from '../config';

export interface DeliveryAddress {
  name: string | null;
  postalCode: string | null;
  prefecture: string | null;
  city: string | null;
  address1: string | null;
  address2: string | null;
  phone: string | null;
}

export interface User {
  id: string;
  phoneNumber: string;
  emailAddress: string;
  name: string | null;
  stripeCustomerId: string | null;
  preferences: Record<string, any>;
  isActive?: boolean;
  faxNumberVerified: boolean;
  faxNumberVerifiedAt: Date | null;
  // Delivery address fields
  deliveryName: string | null;
  deliveryPostalCode: string | null;
  deliveryPrefecture: string | null;
  deliveryCity: string | null;
  deliveryAddress1: string | null;
  deliveryAddress2: string | null;
  deliveryPhone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  phoneNumber: string;
  emailAddress: string;
  name?: string;
  stripeCustomerId?: string;
  preferences?: Record<string, any>;
  isActive?: boolean;
}

export class UserRepository {
  private readonly selectFields = `
    id, phone_number as "phoneNumber", email_address as "emailAddress",
    name, stripe_customer_id as "stripeCustomerId", preferences,
    fax_number_verified as "faxNumberVerified", fax_number_verified_at as "faxNumberVerifiedAt",
    delivery_name as "deliveryName", delivery_postal_code as "deliveryPostalCode",
    delivery_prefecture as "deliveryPrefecture", delivery_city as "deliveryCity",
    delivery_address1 as "deliveryAddress1", delivery_address2 as "deliveryAddress2",
    delivery_phone as "deliveryPhone",
    created_at as "createdAt", updated_at as "updatedAt"
  `;

  /**
   * Find user by phone number
   */
  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    const result = await db.query<User>(
      `SELECT ${this.selectFields}
       FROM users
       WHERE phone_number = $1`,
      [phoneNumber]
    );

    return result.rows[0] || null;
  }

  /**
   * Find user by email address
   */
  async findByEmail(emailAddress: string): Promise<User | null> {
    const result = await db.query<User>(
      `SELECT ${this.selectFields}
       FROM users
       WHERE email_address = $1`,
      [emailAddress]
    );

    return result.rows[0] || null;
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    const result = await db.query<User>(
      `SELECT ${this.selectFields}
       FROM users
       WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Create a new user with default delivery address for testing
   */
  async create(data: CreateUserData & { faxNumberVerified?: boolean }): Promise<User> {
    const defaultPreferences = {
      spamSensitivity: 'medium',
      welcomeFaxSent: false,
      ...data.preferences,
    };

    // Default test address for development
    const defaultAddress = {
      name: 'テスト太郎',
      postalCode: '150-0001',
      prefecture: '東京都',
      city: '渋谷区',
      address1: '神宮前1-2-3',
      address2: 'テストマンション101号',
      phone: '03-1234-5678'
    };

    const result = await db.query<User>(
      `INSERT INTO users (
        phone_number, email_address, name, stripe_customer_id, preferences,
        fax_number_verified, fax_number_verified_at,
        delivery_name, delivery_postal_code, delivery_prefecture,
        delivery_city, delivery_address1, delivery_address2, delivery_phone
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING ${this.selectFields}`,
      [
        data.phoneNumber,
        data.emailAddress,
        data.name || null,
        data.stripeCustomerId || null,
        JSON.stringify(defaultPreferences),
        data.faxNumberVerified || false,
        data.faxNumberVerified ? new Date() : null,
        defaultAddress.name,
        defaultAddress.postalCode,
        defaultAddress.prefecture,
        defaultAddress.city,
        defaultAddress.address1,
        defaultAddress.address2,
        defaultAddress.phone
      ]
    );

    return result.rows[0];
  }

  /**
   * Update user information
   */
  async update(id: string, data: Partial<CreateUserData>): Promise<User> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }

    if (data.stripeCustomerId !== undefined) {
      updates.push(`stripe_customer_id = $${paramIndex++}`);
      values.push(data.stripeCustomerId);
    }

    if (data.preferences !== undefined) {
      updates.push(`preferences = $${paramIndex++}`);
      values.push(JSON.stringify(data.preferences));
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await db.query<User>(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING ${this.selectFields}`,
      values
    );

    return result.rows[0];
  }

  /**
   * Update user's delivery address
   */
  async updateDeliveryAddress(id: string, address: Partial<DeliveryAddress>): Promise<User> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (address.name !== undefined) {
      updates.push(`delivery_name = $${paramIndex++}`);
      values.push(address.name);
    }

    if (address.postalCode !== undefined) {
      updates.push(`delivery_postal_code = $${paramIndex++}`);
      values.push(address.postalCode);
    }

    if (address.prefecture !== undefined) {
      updates.push(`delivery_prefecture = $${paramIndex++}`);
      values.push(address.prefecture);
    }

    if (address.city !== undefined) {
      updates.push(`delivery_city = $${paramIndex++}`);
      values.push(address.city);
    }

    if (address.address1 !== undefined) {
      updates.push(`delivery_address1 = $${paramIndex++}`);
      values.push(address.address1);
    }

    if (address.address2 !== undefined) {
      updates.push(`delivery_address2 = $${paramIndex++}`);
      values.push(address.address2);
    }

    if (address.phone !== undefined) {
      updates.push(`delivery_phone = $${paramIndex++}`);
      values.push(address.phone);
    }

    if (updates.length === 0) {
      throw new Error('No address fields to update');
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await db.query<User>(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING ${this.selectFields}`,
      values
    );

    return result.rows[0];
  }

  /**
   * Get user's delivery address as a structured object
   */
  getDeliveryAddress(user: User): DeliveryAddress {
    return {
      name: user.deliveryName,
      postalCode: user.deliveryPostalCode,
      prefecture: user.deliveryPrefecture,
      city: user.deliveryCity,
      address1: user.deliveryAddress1,
      address2: user.deliveryAddress2,
      phone: user.deliveryPhone
    };
  }

  /**
   * Format delivery address as a single string for display
   */
  formatDeliveryAddress(user: User): string | null {
    if (!user.deliveryPostalCode && !user.deliveryAddress1) {
      return null;
    }

    const parts = [
      user.deliveryPostalCode ? `〒${user.deliveryPostalCode}` : null,
      user.deliveryPrefecture,
      user.deliveryCity,
      user.deliveryAddress1,
      user.deliveryAddress2
    ].filter(Boolean);

    return parts.join(' ');
  }

  /**
   * Update user preferences
   */
  async updatePreferences(id: string, preferences: Record<string, any>): Promise<User> {
    return await this.update(id, { preferences });
  }

  /**
   * Mark a user's fax number as verified (called when they send a real fax to Faxi)
   */
  async markFaxNumberVerified(userId: string): Promise<void> {
    await db.query(
      `UPDATE users
       SET fax_number_verified = TRUE, fax_number_verified_at = NOW()
       WHERE id = $1 AND fax_number_verified = FALSE`,
      [userId]
    );
  }

  /**
   * Generate email address from phone number
   * Format: {phone_number}@{domain}
   */
  generateEmailAddress(phoneNumber: string): string {
    // Remove any non-digit characters
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    return `${cleanPhone}@${config.email.fromDomain}`;
  }

  /**
   * Find or create user by phone number (automatic registration)
   * When called from inbound fax webhook, the user is verified (they sent a real fax)
   */
  async findOrCreate(phoneNumber: string): Promise<{ user: User; isNew: boolean }> {
    // Try to find existing user
    let user = await this.findByPhoneNumber(phoneNumber);

    if (user) {
      // Mark as verified if receiving real fax (don't unset if already true)
      if (!user.faxNumberVerified) {
        await this.markFaxNumberVerified(user.id);
        user.faxNumberVerified = true;
        user.faxNumberVerifiedAt = new Date();
      }
      return { user, isNew: false };
    }

    // Create new user with verified=true (they just sent us a real fax)
    const emailAddress = this.generateEmailAddress(phoneNumber);
    user = await this.create({
      phoneNumber,
      emailAddress,
      faxNumberVerified: true,
    });

    return { user, isNew: true };
  }
}

export const userRepository = new UserRepository();
