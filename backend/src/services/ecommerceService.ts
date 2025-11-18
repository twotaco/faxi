/**
 * E-commerce Service - Mock implementation for product search and ordering
 * 
 * In production, this would integrate with real e-commerce APIs like:
 * - Amazon Product Advertising API
 * - Rakuten API
 * - Yahoo Shopping API
 * - Custom marketplace APIs
 */

export interface ProductSearchResult {
  id: string;
  name: string;
  price: number;
  currency: string;
  description: string;
  imageUrl?: string;
  estimatedDelivery: string;
  availability: 'in_stock' | 'limited' | 'out_of_stock';
  rating?: number;
  reviewCount?: number;
}

export interface ProductDetails extends ProductSearchResult {
  specifications: Record<string, any>;
  reviews: ProductReview[];
  complementaryProducts: string[];
  bundleDeals: BundleDeal[];
}

export interface ProductReview {
  rating: number;
  comment: string;
  reviewer: string;
  date: string;
}

export interface BundleDeal {
  id: string;
  name: string;
  products: string[];
  originalPrice: number;
  bundlePrice: number;
  savings: number;
}

export interface OrderRequest {
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  paymentMethodId?: string;
}

export interface OrderItem {
  productId: string;
  quantity: number;
}

export interface ShippingAddress {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface OrderResult {
  orderId: string;
  status: 'pending' | 'confirmed' | 'processing';
  trackingNumber?: string;
  estimatedDelivery: string;
  total: number;
  currency: string;
}

export class EcommerceService {
  private mockProducts: ProductDetails[] = [
    // Batteries
    {
      id: 'bat-aa-001',
      name: 'Energizer AA Batteries (4-pack)',
      price: 380,
      currency: 'JPY',
      description: 'Long-lasting alkaline AA batteries, perfect for flashlights and remote controls',
      imageUrl: 'https://example.com/energizer-aa.jpg',
      estimatedDelivery: '1-2 days',
      availability: 'in_stock',
      rating: 4.5,
      reviewCount: 234,
      specifications: {
        type: 'Alkaline',
        voltage: '1.5V',
        count: 4,
        brand: 'Energizer'
      },
      reviews: [
        { rating: 5, comment: 'Great batteries, last long', reviewer: 'Tanaka', date: '2024-01-15' },
        { rating: 4, comment: 'Good value for money', reviewer: 'Sato', date: '2024-01-10' }
      ],
      complementaryProducts: ['flash-led-001', 'bat-tester-001'],
      bundleDeals: [
        {
          id: 'bundle-001',
          name: 'Flashlight + Batteries Bundle',
          products: ['bat-aa-001', 'flash-led-001'],
          originalPrice: 1580,
          bundlePrice: 1400,
          savings: 180
        }
      ]
    },
    {
      id: 'bat-aaa-001',
      name: 'Panasonic AAA Batteries (8-pack)',
      price: 450,
      currency: 'JPY',
      description: 'High-performance AAA batteries for small devices',
      imageUrl: 'https://example.com/panasonic-aaa.jpg',
      estimatedDelivery: '1-2 days',
      availability: 'in_stock',
      rating: 4.3,
      reviewCount: 156,
      specifications: {
        type: 'Alkaline',
        voltage: '1.5V',
        count: 8,
        brand: 'Panasonic'
      },
      reviews: [],
      complementaryProducts: ['bat-tester-001'],
      bundleDeals: []
    },
    {
      id: 'bat-tester-001',
      name: 'Digital Battery Tester',
      price: 680,
      currency: 'JPY',
      description: 'Test battery charge levels for AA, AAA, C, D, and 9V batteries',
      imageUrl: 'https://example.com/battery-tester.jpg',
      estimatedDelivery: '2-3 days',
      availability: 'in_stock',
      rating: 4.2,
      reviewCount: 89,
      specifications: {
        type: 'Digital Tester',
        compatibility: ['AA', 'AAA', 'C', 'D', '9V'],
        display: 'LCD'
      },
      reviews: [],
      complementaryProducts: ['bat-aa-001', 'bat-aaa-001'],
      bundleDeals: []
    },

    // Flashlights
    {
      id: 'flash-led-001',
      name: 'LED Flashlight - Waterproof',
      price: 1200,
      currency: 'JPY',
      description: 'Bright LED flashlight with waterproof design, perfect for emergencies',
      imageUrl: 'https://example.com/led-flashlight.jpg',
      estimatedDelivery: '1-2 days',
      availability: 'in_stock',
      rating: 4.7,
      reviewCount: 312,
      specifications: {
        brightness: '1000 lumens',
        waterproof: 'IPX7',
        battery: '3 AA batteries',
        material: 'Aluminum alloy'
      },
      reviews: [
        { rating: 5, comment: 'Very bright and durable', reviewer: 'Yamada', date: '2024-01-20' }
      ],
      complementaryProducts: ['bat-aa-001', 'flash-case-001'],
      bundleDeals: [
        {
          id: 'bundle-001',
          name: 'Flashlight + Batteries Bundle',
          products: ['flash-led-001', 'bat-aa-001'],
          originalPrice: 1580,
          bundlePrice: 1400,
          savings: 180
        }
      ]
    },
    {
      id: 'flash-mini-001',
      name: 'Mini Keychain Flashlight',
      price: 280,
      currency: 'JPY',
      description: 'Compact LED flashlight for everyday carry',
      imageUrl: 'https://example.com/mini-flashlight.jpg',
      estimatedDelivery: '1-2 days',
      availability: 'in_stock',
      rating: 4.1,
      reviewCount: 145,
      specifications: {
        brightness: '50 lumens',
        battery: '1 CR2032',
        size: 'Keychain',
        material: 'Plastic'
      },
      reviews: [],
      complementaryProducts: ['bat-cr2032-001'],
      bundleDeals: []
    },

    // Shampoo
    {
      id: 'shamp-moist-001',
      name: 'Moisturizing Shampoo 500ml',
      price: 850,
      currency: 'JPY',
      description: 'Gentle moisturizing shampoo for dry hair',
      imageUrl: 'https://example.com/moisturizing-shampoo.jpg',
      estimatedDelivery: '1-2 days',
      availability: 'in_stock',
      rating: 4.4,
      reviewCount: 267,
      specifications: {
        volume: '500ml',
        type: 'Moisturizing',
        suitableFor: 'Dry hair',
        ingredients: 'Natural oils'
      },
      reviews: [],
      complementaryProducts: ['cond-moist-001', 'soap-hand-001'],
      bundleDeals: []
    },
    {
      id: 'shamp-daily-001',
      name: 'Daily Use Shampoo 400ml',
      price: 650,
      currency: 'JPY',
      description: 'Gentle daily shampoo for all hair types',
      imageUrl: 'https://example.com/daily-shampoo.jpg',
      estimatedDelivery: '1-2 days',
      availability: 'in_stock',
      rating: 4.2,
      reviewCount: 189,
      specifications: {
        volume: '400ml',
        type: 'Daily use',
        suitableFor: 'All hair types'
      },
      reviews: [],
      complementaryProducts: ['cond-daily-001'],
      bundleDeals: []
    },

    // Toilet Paper
    {
      id: 'tp-soft-12',
      name: 'Soft Toilet Paper 12-roll pack',
      price: 580,
      currency: 'JPY',
      description: 'Soft 2-ply toilet paper, comfortable and absorbent',
      imageUrl: 'https://example.com/toilet-paper-12.jpg',
      estimatedDelivery: '1-2 days',
      availability: 'in_stock',
      rating: 4.3,
      reviewCount: 445,
      specifications: {
        ply: '2-ply',
        rolls: 12,
        sheets: '200 per roll',
        softness: 'Extra soft'
      },
      reviews: [],
      complementaryProducts: ['tissue-box-001', 'soap-hand-001'],
      bundleDeals: []
    },
    {
      id: 'tp-bulk-24',
      name: 'Bulk Toilet Paper 24-roll pack',
      price: 980,
      currency: 'JPY',
      description: 'Bulk pack of soft 2-ply toilet paper, great value',
      imageUrl: 'https://example.com/toilet-paper-24.jpg',
      estimatedDelivery: '2-3 days',
      availability: 'in_stock',
      rating: 4.5,
      reviewCount: 234,
      specifications: {
        ply: '2-ply',
        rolls: 24,
        sheets: '200 per roll',
        softness: 'Extra soft'
      },
      reviews: [],
      complementaryProducts: ['tissue-box-001'],
      bundleDeals: []
    },

    // Coffee makers
    {
      id: 'coffee-drip-001',
      name: 'Drip Coffee Maker 10-cup',
      price: 3500,
      currency: 'JPY',
      description: 'Automatic drip coffee maker with 10-cup capacity',
      imageUrl: 'https://example.com/drip-coffee-maker.jpg',
      estimatedDelivery: '2-3 days',
      availability: 'in_stock',
      rating: 4.6,
      reviewCount: 178,
      specifications: {
        capacity: '10 cups',
        type: 'Drip',
        features: ['Auto shut-off', 'Programmable timer'],
        material: 'Stainless steel'
      },
      reviews: [],
      complementaryProducts: ['coffee-filter-001', 'coffee-beans-001'],
      bundleDeals: []
    },

    // Complementary items
    {
      id: 'soap-hand-001',
      name: 'Hand Soap 300ml',
      price: 320,
      currency: 'JPY',
      description: 'Gentle hand soap with moisturizing formula',
      estimatedDelivery: '1-2 days',
      availability: 'in_stock',
      specifications: { volume: '300ml', type: 'Moisturizing' },
      reviews: [],
      complementaryProducts: [],
      bundleDeals: []
    },
    {
      id: 'tissue-box-001',
      name: 'Facial Tissues (5 boxes)',
      price: 450,
      currency: 'JPY',
      description: 'Soft facial tissues, 5-box pack',
      estimatedDelivery: '1-2 days',
      availability: 'in_stock',
      specifications: { boxes: 5, sheets: '200 per box' },
      reviews: [],
      complementaryProducts: [],
      bundleDeals: []
    }
  ];

  /**
   * Search for products by query
   */
  async searchProducts(query: string, maxResults: number = 5): Promise<ProductSearchResult[]> {
    // Simulate API delay
    await this.delay(200);

    const searchTerms = query.toLowerCase().split(' ');
    
    const results = this.mockProducts
      .filter(product => {
        const searchText = `${product.name} ${product.description}`.toLowerCase();
        return searchTerms.some(term => searchText.includes(term));
      })
      .slice(0, maxResults)
      .map(product => ({
        id: product.id,
        name: product.name,
        price: product.price,
        currency: product.currency,
        description: product.description,
        imageUrl: product.imageUrl,
        estimatedDelivery: product.estimatedDelivery,
        availability: product.availability,
        rating: product.rating,
        reviewCount: product.reviewCount
      }));

    return results;
  }

  /**
   * Get detailed product information
   */
  async getProductDetails(productId: string): Promise<ProductDetails | null> {
    // Simulate API delay
    await this.delay(150);

    const product = this.mockProducts.find(p => p.id === productId);
    return product || null;
  }

  /**
   * Get complementary products for a given product
   */
  async getComplementaryProducts(productId: string): Promise<ProductSearchResult[]> {
    const product = this.mockProducts.find(p => p.id === productId);
    if (!product || !product.complementaryProducts.length) {
      return [];
    }

    return this.mockProducts
      .filter(p => product.complementaryProducts.includes(p.id))
      .map(product => ({
        id: product.id,
        name: product.name,
        price: product.price,
        currency: product.currency,
        description: product.description,
        imageUrl: product.imageUrl,
        estimatedDelivery: product.estimatedDelivery,
        availability: product.availability,
        rating: product.rating,
        reviewCount: product.reviewCount
      }));
  }

  /**
   * Get bundle deals for products
   */
  async getBundleDeals(productIds: string[]): Promise<BundleDeal[]> {
    const deals: BundleDeal[] = [];
    
    for (const productId of productIds) {
      const product = this.mockProducts.find(p => p.id === productId);
      if (product && product.bundleDeals.length > 0) {
        deals.push(...product.bundleDeals);
      }
    }

    // Remove duplicates
    const uniqueDeals = deals.filter((deal, index, self) => 
      index === self.findIndex(d => d.id === deal.id)
    );

    return uniqueDeals;
  }

  /**
   * Place an order
   */
  async placeOrder(orderRequest: OrderRequest): Promise<OrderResult> {
    // Simulate API delay
    await this.delay(500);

    // Calculate total
    let total = 0;
    for (const item of orderRequest.items) {
      const product = this.mockProducts.find(p => p.id === item.productId);
      if (product) {
        total += product.price * item.quantity;
      }
    }

    // Generate mock order ID and tracking
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const trackingNumber = `JP${Date.now().toString().slice(-8)}`;

    return {
      orderId,
      status: 'confirmed',
      trackingNumber,
      estimatedDelivery: '2-3 business days',
      total,
      currency: 'JPY'
    };
  }

  /**
   * Get order status and tracking
   */
  async getOrderStatus(orderId: string): Promise<{ status: string; trackingNumber?: string; estimatedDelivery?: string } | null> {
    // Simulate API delay
    await this.delay(100);

    // Mock order status
    return {
      status: 'shipped',
      trackingNumber: `JP${Date.now().toString().slice(-8)}`,
      estimatedDelivery: '1-2 business days'
    };
  }

  /**
   * Simulate network delay
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const ecommerceService = new EcommerceService();