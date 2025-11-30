import { db } from '../database/connection';

export interface User {
  id: string;
  phoneNumber: string;
  emailAddress: string;
  name: string | null;
  stripeCustomerId: string | null;
  preferences: Record<string, any>;
  isActive?: boolean;
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
  /**
   * Find user by phone number
   */
  async findByPhoneNumber(phoneNumber: string): Promise<User | null> {
    const result = await db.query<User>(
      `SELECT id, phone_number as "phoneNumber", email_address as "emailAddress", 
              name, stripe_customer_id as "stripeCustomerId", preferences,
              created_at as "createdAt", updated_at as "updatedAt"
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
      `SELECT id, phone_number as "phoneNumber", email_address as "emailAddress", 
              name, stripe_customer_id as "stripeCustomerId", preferences,
              created_at as "createdAt", updated_at as "updatedAt"
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
      `SELECT id, phone_number as "phoneNumber", email_address as "emailAddress", 
              name, stripe_customer_id as "stripeCustomerId", preferences,
              created_at as "createdAt", updated_at as "updatedAt"
       FROM users 
       WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Create a new user
   */
  async create(data: CreateUserData): Promise<User> {
    const defaultPreferences = {
      spamSensitivity: 'medium',
      welcomeFaxSent: false,
      ...data.preferences,
    };

    const result = await db.query<User>(
      `INSERT INTO users (phone_number, email_address, name, stripe_customer_id, preferences)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, phone_number as "phoneNumber", email_address as "emailAddress", 
                 name, stripe_customer_id as "stripeCustomerId", preferences,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        data.phoneNumber, 
        data.emailAddress, 
        data.name || null, 
        data.stripeCustomerId || null,
        JSON.stringify(defaultPreferences)
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

    values.push(id);

    const result = await db.query<User>(
      `UPDATE users 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, phone_number as "phoneNumber", email_address as "emailAddress", 
                 name, stripe_customer_id as "stripeCustomerId", preferences,
                 created_at as "createdAt", updated_at as "updatedAt"`,
      values
    );

    return result.rows[0];
  }

  /**
   * Update user preferences
   */
  async updatePreferences(id: string, preferences: Record<string, any>): Promise<User> {
    return await this.update(id, { preferences });
  }

  /**
   * Generate email address from phone number
   * Format: {phone_number}@me.faxi.jp
   */
  generateEmailAddress(phoneNumber: string): string {
    // Remove any non-digit characters
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    return `${cleanPhone}@me.faxi.jp`;
  }

  /**
   * Find or create user by phone number (automatic registration)
   */
  async findOrCreate(phoneNumber: string): Promise<{ user: User; isNew: boolean }> {
    // Try to find existing user
    let user = await this.findByPhoneNumber(phoneNumber);
    
    if (user) {
      return { user, isNew: false };
    }

    // Create new user
    const emailAddress = this.generateEmailAddress(phoneNumber);
    user = await this.create({
      phoneNumber,
      emailAddress,
    });

    return { user, isNew: true };
  }
}

export const userRepository = new UserRepository();
