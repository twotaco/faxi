import { MCPServer, MCPTool } from '../types/agent';
import { productSearchService, PAAPIProduct } from '../services/productSearchService';
import { orderRepository, CreateOrderData } from '../repositories/orderRepository';
import { userRepository } from '../repositories/userRepository';
import { auditLogService } from '../services/auditLogService';
import { conversationContextRepository } from '../repositories/conversationContextRepository';

/**
 * Shopping MCP Server - Provides shopping tools to the MCP Controller Agent
 * 
 * This server handles:
 * - Product search via Playwright scraping with aggressive caching
 * - Product details retrieval
 * - Order creation and management
 * - Order status tracking
 * - User order history
 */
export class ShoppingMCPServer implements MCPServer {
  name = 'shopping';
  description = 'E-commerce shopping and order management tools';
  tools: MCPTool[] = [];

  constructor() {
    this.initializeTools();
  }

  private initializeTools(): void {
    this.tools = [
      this.createSearchProductsTool(),
      this.createGetProductDetailsTool(),
      this.createCreateOrderTool(),
      this.createGetOrderStatusTool(),
      this.createListUserOrdersTool(),
    ];
  }

  /**
   * Search products tool - Search Amazon products with filters
   */
  private createSearchProductsTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID performing the search'
        },
        query: {
          type: 'string',
          description: 'Product search query (keywords)'
        },
        filters: {
          type: 'object',
          properties: {
            priceMin: {
              type: 'number',
              description: 'Minimum price in Japanese Yen'
            },
            priceMax: {
              type: 'number',
              description: 'Maximum price in Japanese Yen'
            },
            primeOnly: {
              type: 'boolean',
              description: 'Filter for Prime-eligible products only',
              default: true
            },
            minRating: {
              type: 'number',
              description: 'Minimum product rating (0-5)',
              default: 3.5
            },
            category: {
              type: 'string',
              description: 'Product category filter'
            }
          }
        }
      },
      required: ['userId', 'query']
    };

    return {
      name: 'search_products',
      description: 'Search Amazon.co.jp products with quality filters',
      inputSchema,
      handler: this.handleSearchProducts.bind(this)
    };
  }

  /**
   * Get product details tool - Retrieve detailed product information
   */
  private createGetProductDetailsTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID requesting product details'
        },
        asin: {
          type: 'string',
          description: 'Amazon Standard Identification Number (ASIN)'
        }
      },
      required: ['userId', 'asin']
    };

    return {
      name: 'get_product_details',
      description: 'Get detailed information about a specific product by ASIN',
      inputSchema,
      handler: this.handleGetProductDetails.bind(this)
    };
  }

  /**
   * Create order tool - Create a new shopping order
   */
  private createCreateOrderTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID placing the order'
        },
        referenceId: {
          type: 'string',
          description: 'Reference ID linking to fax conversation'
        },
        productAsin: {
          type: 'string',
          description: 'Product ASIN to order'
        },
        quantity: {
          type: 'number',
          description: 'Quantity to order',
          default: 1
        }
      },
      required: ['userId', 'referenceId', 'productAsin']
    };

    return {
      name: 'create_order',
      description: 'Create a new shopping order for a product',
      inputSchema,
      handler: this.handleCreateOrder.bind(this)
    };
  }

  /**
   * Get order status tool - Retrieve order status by reference ID
   */
  private createGetOrderStatusTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID requesting order status'
        },
        referenceId: {
          type: 'string',
          description: 'Reference ID of the order'
        }
      },
      required: ['userId', 'referenceId']
    };

    return {
      name: 'get_order_status',
      description: 'Get order status and tracking information by reference ID',
      inputSchema,
      handler: this.handleGetOrderStatus.bind(this)
    };
  }

  /**
   * List user orders tool - Retrieve user's order history
   */
  private createListUserOrdersTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID to retrieve orders for'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of orders to return',
          default: 10
        }
      },
      required: ['userId']
    };

    return {
      name: 'list_user_orders',
      description: 'List user\'s order history',
      inputSchema,
      handler: this.handleListUserOrders.bind(this)
    };
  }

  /**
   * Handle search products request
   */
  private async handleSearchProducts(params: any): Promise<any> {
    const { userId, query, filters = {} } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Set default filters per requirements
      const searchFilters = {
        priceMin: filters.priceMin,
        priceMax: filters.priceMax,
        primeOnly: filters.primeOnly !== undefined ? filters.primeOnly : true,
        minRating: filters.minRating !== undefined ? filters.minRating : 3.5,
        category: filters.category
      };

      // Search products using Playwright scraping with cache
      const products = await productSearchService.searchProducts(query, searchFilters, userId);

      // Add selection markers (A, B, C, D, E) to products
      const selectionMarkers: ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E'];
      const productsWithMarkers = products.slice(0, 5).map((p, index) => ({
        asin: p.asin,
        productName: p.productName,
        brand: p.brand,
        quantity: p.quantity,
        description: p.description,
        title: this.truncateTitle(p.title, 60),
        price: p.price,
        currency: p.currency,
        primeEligible: p.primeEligible,
        rating: p.rating,
        reviewCount: p.reviewCount,
        availability: this.getAvailabilityStatus(p),
        deliveryEstimate: this.getDeliveryEstimate(p),
        imageUrl: p.imageUrl,
        detailPageUrl: p.productUrl,
        seller: p.seller,
        selectionMarker: selectionMarkers[index]
      }));

      // Generate reference ID for this shopping session
      const referenceId = `FX-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      // Save shopping context for product selection
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Context expires in 7 days

      await conversationContextRepository.create({
        userId,
        referenceId,
        contextType: 'shopping',
        contextData: {
          searchQuery: query,
          searchFilters,
          searchResults: productsWithMarkers,
          timestamp: new Date().toISOString()
        },
        expiresAt
      });

      // Log the search via MCP tool call (faxJobId is null for demo/direct MCP calls)
      await auditLogService.logMCPToolCall({
        userId,
        faxJobId: null,
        toolName: 'search_products',
        toolServer: 'shopping',
        input: { query, filters: searchFilters },
        output: { resultCount: productsWithMarkers.length, referenceId },
        success: true
      });

      return {
        success: true,
        products: productsWithMarkers,
        query,
        filters: searchFilters,
        resultCount: productsWithMarkers.length,
        referenceId // Include reference ID in response for fax generation
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search products'
      };
    }
  }

  /**
   * Handle get product details request
   */
  private async handleGetProductDetails(params: any): Promise<any> {
    const { userId, asin } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Get product details from cache or scrape
      const product = await productSearchService.getProductDetails(asin, userId);

      if (!product) {
        return {
          success: false,
          error: `Product not found: ${asin}`
        };
      }

      return {
        success: true,
        product: {
          asin: product.asin,
          title: product.title,
          price: product.price,
          currency: product.currency,
          primeEligible: product.primeEligible,
          rating: product.rating,
          reviewCount: product.reviewCount,
          availability: this.getAvailabilityStatus(product),
          deliveryEstimate: this.getDeliveryEstimate(product),
          imageUrl: product.imageUrl,
          detailPageUrl: product.productUrl,
          seller: product.seller,
          description: product.description || '',
          features: product.features || [],
          brand: product.brand || ''
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get product details'
      };
    }
  }

  /**
   * Handle create order request
   */
  private async handleCreateOrder(params: any): Promise<any> {
    const { userId, referenceId, productAsin, quantity = 1 } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Get product details to validate and get current price (force fresh scrape)
      const product = await productSearchService.getProductDetails(productAsin, userId, true);
      
      if (!product) {
        return {
          success: false,
          error: `Product not found: ${productAsin}`
        };
      }

      // Check product availability
      const availability = this.getAvailabilityStatus(product);
      if (availability === 'out_of_stock') {
        return {
          success: false,
          error: 'Product is currently out of stock',
          availability
        };
      }

      // Calculate total amount
      const totalAmount = product.price * quantity;

      // Create order with status "pending_payment"
      const orderData: CreateOrderData = {
        userId,
        referenceId,
        status: 'pending',
        totalAmount,
        currency: 'JPY',
        items: {
          products: [{
            asin: product.asin,
            title: product.title,
            price: product.price,
            quantity,
            primeEligible: product.primeEligible,
            imageUrl: product.imageUrl
          }]
        },
        shippingAddress: null // Will be collected during order fulfillment
      };

      const order = await orderRepository.create(orderData);

      // Log order creation via MCP tool call (faxJobId is null for demo/direct MCP calls)
      await auditLogService.logMCPToolCall({
        userId,
        faxJobId: null,
        toolName: 'create_order',
        toolServer: 'shopping',
        input: { productAsin, quantity, referenceId },
        output: { orderId: order.id, totalAmount },
        success: true
      });

      return {
        success: true,
        order: {
          id: order.id,
          referenceId: order.referenceId,
          status: order.status,
          totalAmount: order.totalAmount,
          currency: order.currency,
          items: order.items,
          createdAt: order.createdAt
        },
        product: {
          asin: product.asin,
          title: product.title,
          price: product.price,
          imageUrl: product.imageUrl
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create order'
      };
    }
  }

  /**
   * Handle get order status request
   */
  private async handleGetOrderStatus(params: any): Promise<any> {
    const { userId, referenceId } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Find order by reference ID
      const order = await orderRepository.findByReferenceId(referenceId);
      
      if (!order) {
        return {
          success: false,
          error: `Order not found with reference ID: ${referenceId}`
        };
      }

      // Verify order belongs to user
      if (order.userId !== userId) {
        return {
          success: false,
          error: 'Access denied to order'
        };
      }

      // Parse items to get product information
      const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

      return {
        success: true,
        order: {
          id: order.id,
          referenceId: order.referenceId,
          status: order.status,
          totalAmount: order.totalAmount,
          currency: order.currency,
          items: items,
          trackingNumber: order.trackingNumber,
          externalOrderId: order.externalOrderId,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get order status'
      };
    }
  }

  /**
   * Handle list user orders request
   */
  private async handleListUserOrders(params: any): Promise<any> {
    const { userId, limit = 10 } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Get user's orders
      const orders = await orderRepository.findByUserId(userId, limit);

      return {
        success: true,
        orders: orders.map(order => {
          const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
          
          return {
            id: order.id,
            referenceId: order.referenceId,
            status: order.status,
            totalAmount: order.totalAmount,
            currency: order.currency,
            items: items,
            trackingNumber: order.trackingNumber,
            externalOrderId: order.externalOrderId,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt
          };
        }),
        count: orders.length
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list user orders'
      };
    }
  }

  /**
   * Truncate product title to specified length for fax readability
   */
  private truncateTitle(title: string, maxLength: number): string {
    if (title.length <= maxLength) {
      return title;
    }

    // Truncate at word boundary if possible
    const truncated = title.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.8) {
      // If we can find a space in the last 20%, use it
      return truncated.substring(0, lastSpace) + '...';
    }

    // Otherwise, hard truncate
    return truncated.substring(0, maxLength - 3) + '...';
  }

  /**
   * Get delivery estimate based on product data
   */
  private getDeliveryEstimate(product: PAAPIProduct): string {
    // Use scraped delivery estimate if available
    if (product.deliveryEstimate) {
      return product.deliveryEstimate;
    }

    // Fallback estimates
    if (product.primeEligible) {
      return '2-3日でお届け'; // 2-3 days delivery
    }

    return '5-7日でお届け'; // 5-7 days delivery
  }

  /**
   * Get availability status from product data
   */
  private getAvailabilityStatus(product: PAAPIProduct): 'in_stock' | 'limited' | 'out_of_stock' {
    const delivery = product.deliveryEstimate || '';
    
    if (delivery.includes('在庫切れ') || delivery.includes('配送日未定')) {
      return 'out_of_stock';
    }
    
    if (delivery.includes('予約')) {
      return 'limited';
    }
    
    return 'in_stock';
  }
}

// Export singleton instance
export const shoppingMCPServer = new ShoppingMCPServer();
