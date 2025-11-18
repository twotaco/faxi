import { db } from '../database/connection';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  estimatedDelivery?: string;
}

export interface ShoppingCart {
  id: string;
  userId: string;
  items: CartItem[];
  totalAmount: number;
  currency: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCartData {
  userId: string;
  items?: CartItem[];
  totalAmount?: number;
  currency?: string;
}

export interface UpdateCartData {
  items?: CartItem[];
  totalAmount?: number;
}

export class ShoppingCartRepository {
  /**
   * Find cart by user ID
   */
  async findByUserId(userId: string): Promise<ShoppingCart | null> {
    const result = await db.query<ShoppingCart>(
      `SELECT id, user_id as "userId", items, total_amount as "totalAmount",
              currency, expires_at as "expiresAt", created_at as "createdAt", 
              updated_at as "updatedAt"
       FROM shopping_carts 
       WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [userId]
    );

    const cart = result.rows[0];
    if (cart) {
      // Parse JSON items
      cart.items = typeof cart.items === 'string' ? JSON.parse(cart.items as string) : cart.items;
    }

    return cart || null;
  }

  /**
   * Create or update cart for user
   */
  async upsert(data: CreateCartData): Promise<ShoppingCart> {
    const items = data.items || [];
    const totalAmount = data.totalAmount || this.calculateTotal(items);
    
    const result = await db.query<ShoppingCart>(
      `INSERT INTO shopping_carts (user_id, items, total_amount, currency)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         items = EXCLUDED.items,
         total_amount = EXCLUDED.total_amount,
         currency = EXCLUDED.currency,
         expires_at = CURRENT_TIMESTAMP + INTERVAL '7 days',
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, user_id as "userId", items, total_amount as "totalAmount",
                 currency, expires_at as "expiresAt", created_at as "createdAt", 
                 updated_at as "updatedAt"`,
      [
        data.userId,
        JSON.stringify(items),
        totalAmount,
        data.currency || 'JPY'
      ]
    );

    const cart = result.rows[0];
    cart.items = typeof cart.items === 'string' ? JSON.parse(cart.items as string) : cart.items;
    return cart;
  }

  /**
   * Add item to cart
   */
  async addItem(userId: string, item: CartItem): Promise<ShoppingCart> {
    // Get existing cart or create empty one
    let cart = await this.findByUserId(userId);
    let items: CartItem[] = cart ? cart.items : [];

    // Check if item already exists in cart
    const existingItemIndex = items.findIndex(i => i.productId === item.productId);
    
    if (existingItemIndex >= 0) {
      // Update quantity of existing item
      items[existingItemIndex].quantity += item.quantity;
    } else {
      // Add new item
      items.push(item);
    }

    return await this.upsert({
      userId,
      items,
      totalAmount: this.calculateTotal(items)
    });
  }

  /**
   * Remove item from cart
   */
  async removeItem(userId: string, productId: string): Promise<ShoppingCart> {
    const cart = await this.findByUserId(userId);
    if (!cart) {
      throw new Error('Cart not found');
    }

    const items = cart.items.filter(item => item.productId !== productId);
    
    return await this.upsert({
      userId,
      items,
      totalAmount: this.calculateTotal(items)
    });
  }

  /**
   * Update item quantity in cart
   */
  async updateItemQuantity(userId: string, productId: string, quantity: number): Promise<ShoppingCart> {
    const cart = await this.findByUserId(userId);
    if (!cart) {
      throw new Error('Cart not found');
    }

    let items = cart.items;
    const itemIndex = items.findIndex(i => i.productId === productId);
    
    if (itemIndex === -1) {
      throw new Error('Item not found in cart');
    }

    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      items = items.filter(item => item.productId !== productId);
    } else {
      // Update quantity
      items[itemIndex].quantity = quantity;
    }

    return await this.upsert({
      userId,
      items,
      totalAmount: this.calculateTotal(items)
    });
  }

  /**
   * Clear cart
   */
  async clear(userId: string): Promise<void> {
    await db.query(
      `DELETE FROM shopping_carts WHERE user_id = $1`,
      [userId]
    );
  }

  /**
   * Clean up expired carts
   */
  async cleanupExpired(): Promise<number> {
    const result = await db.query(
      `DELETE FROM shopping_carts WHERE expires_at <= CURRENT_TIMESTAMP`
    );
    
    return result.rowCount || 0;
  }

  /**
   * Calculate total amount for cart items
   */
  private calculateTotal(items: CartItem[]): number {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }
}

export const shoppingCartRepository = new ShoppingCartRepository();