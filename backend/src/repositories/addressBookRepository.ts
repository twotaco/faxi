import { db } from '../database/connection';

export interface AddressBookEntry {
  id: string;
  userId: string;
  name: string;
  emailAddress: string;
  relationship: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAddressBookEntryData {
  userId: string;
  name: string;
  emailAddress: string;
  relationship?: string;
  notes?: string;
}

export interface UpdateAddressBookEntryData {
  name?: string;
  emailAddress?: string;
  relationship?: string;
  notes?: string;
}

export class AddressBookRepository {
  /**
   * Find address book entry by ID
   */
  async findById(id: string): Promise<AddressBookEntry | null> {
    const result = await db.query<AddressBookEntry>(
      `SELECT id, user_id as "userId", name, email_address as "emailAddress",
              relationship, notes, created_at as "createdAt", updated_at as "updatedAt"
       FROM address_book 
       WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  /**
   * Find all address book entries for a user
   */
  async findByUserId(userId: string): Promise<AddressBookEntry[]> {
    const result = await db.query<AddressBookEntry>(
      `SELECT id, user_id as "userId", name, email_address as "emailAddress",
              relationship, notes, created_at as "createdAt", updated_at as "updatedAt"
       FROM address_book 
       WHERE user_id = $1
       ORDER BY name ASC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Find address book entry by user ID and email address
   */
  async findByUserAndEmail(
    userId: string,
    emailAddress: string
  ): Promise<AddressBookEntry | null> {
    const result = await db.query<AddressBookEntry>(
      `SELECT id, user_id as "userId", name, email_address as "emailAddress",
              relationship, notes, created_at as "createdAt", updated_at as "updatedAt"
       FROM address_book
       WHERE user_id = $1 AND email_address = $2`,
      [userId, emailAddress]
    );

    return result.rows[0] || null;
  }

  /**
   * Find address book entry by email (alias for findByUserAndEmail)
   */
  async findByEmail(
    userId: string,
    emailAddress: string
  ): Promise<AddressBookEntry | null> {
    return this.findByUserAndEmail(userId, emailAddress);
  }

  /**
   * Search contacts by name, email, or relationship
   * Case-insensitive partial match
   */
  async searchByNameOrRelationship(
    userId: string,
    query: string
  ): Promise<AddressBookEntry[]> {
    const result = await db.query<AddressBookEntry>(
      `SELECT id, user_id as "userId", name, email_address as "emailAddress",
              relationship, notes, created_at as "createdAt", updated_at as "updatedAt"
       FROM address_book
       WHERE user_id = $1
         AND (name ILIKE $2 OR email_address ILIKE $2 OR relationship ILIKE $2)
       ORDER BY name ASC`,
      [userId, `%${query}%`]
    );

    return result.rows;
  }

  /**
   * Create a new address book entry
   */
  async create(data: CreateAddressBookEntryData): Promise<AddressBookEntry> {
    const result = await db.query<AddressBookEntry>(
      `INSERT INTO address_book (user_id, name, email_address, relationship, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id as "userId", name, email_address as "emailAddress",
                 relationship, notes, created_at as "createdAt", updated_at as "updatedAt"`,
      [
        data.userId,
        data.name,
        data.emailAddress,
        data.relationship || null,
        data.notes || null,
      ]
    );

    return result.rows[0];
  }

  /**
   * Update address book entry
   */
  async update(id: string, data: UpdateAddressBookEntryData): Promise<AddressBookEntry> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }

    if (data.emailAddress !== undefined) {
      updates.push(`email_address = $${paramIndex++}`);
      values.push(data.emailAddress);
    }

    if (data.relationship !== undefined) {
      updates.push(`relationship = $${paramIndex++}`);
      values.push(data.relationship);
    }

    if (data.notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      values.push(data.notes);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(id);

    const result = await db.query<AddressBookEntry>(
      `UPDATE address_book 
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, user_id as "userId", name, email_address as "emailAddress",
                 relationship, notes, created_at as "createdAt", updated_at as "updatedAt"`,
      values
    );

    return result.rows[0];
  }

  /**
   * Delete address book entry
   */
  async delete(id: string): Promise<void> {
    await db.query(`DELETE FROM address_book WHERE id = $1`, [id]);
  }

  /**
   * Add contact from email automatically
   * If contact already exists, update the name if provided
   */
  async addFromEmail(
    userId: string,
    emailAddress: string,
    name?: string
  ): Promise<AddressBookEntry> {
    // Check if contact already exists
    const existing = await this.findByUserAndEmail(userId, emailAddress);

    if (existing) {
      // Update name if provided and different
      if (name && name !== existing.name) {
        return await this.update(existing.id, { name });
      }
      return existing;
    }

    // Create new contact
    return await this.create({
      userId,
      name: name || emailAddress.split('@')[0], // Use email prefix as default name
      emailAddress,
    });
  }
}

export const addressBookRepository = new AddressBookRepository();
