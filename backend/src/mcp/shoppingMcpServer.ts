import { GoogleGenerativeAI } from '@google/generative-ai';
import { MCPServer, MCPTool } from '../types/agent';
import { shoppingCartRepository, CartItem } from '../repositories/shoppingCartRepository';
import { productCacheRepository } from '../repositories/productCacheRepository';
import { orderRepository } from '../repositories/orderRepository';
import { userRepository } from '../repositories/userRepository';
import { auditLogService } from '../services/auditLogService';
import { ecommerceService, ProductSearchResult, ProductDetails } from '../services/ecommerceService';
import { config } from '../config';

/**
 * Shopping MCP Server - Provides e-commerce tools to the MCP Controller Agent
 * 
 * This server handles:
 * - Product search and details
 * - Shopping cart management
 * - Order placement and tracking
 * - Complementary products and bundle deals
 */
export class ShoppingMCPServer implements MCPServer {
  name = 'shopping';
  description = 'E-commerce and shopping tools';
  tools: MCPTool[] = [];
  private genAI: GoogleGenerativeAI;

  constructor() {
    // Initialize Google Gemini AI
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    
    this.initializeTools();
  }

  private initializeTools(): void {
    this.tools = [
      this.createShoppingRequestTool(),
      this.createSearchProductsTool(),
      this.createGetProductDetailsTool(),
      this.createAddToCartTool(),
      this.createGetCartTool(),
      this.createUpdateCartItemTool(),
      this.createRemoveFromCartTool(),
      this.createCheckoutTool(),
      this.createGetComplementaryProductsTool(),
      this.createGetBundleDealsTool(),
    ];
  }

  /**
   * Shopping request tool - High-level shopping assistant with structured outputs
   */
  private createShoppingRequestTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        message: {
          type: 'string',
          description: 'User shopping request or message'
        },
        conversationHistory: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string' },
              content: { type: 'string' }
            }
          },
          description: 'Optional conversation history for context'
        }
      },
      required: ['userId', 'message']
    };

    return {
      name: 'shopping_request',
      description: 'Process shopping request with AI assistance and structured outputs',
      inputSchema,
      handler: this.handleShoppingRequest.bind(this)
    };
  }

  /**
   * Search products tool - Searches for products by query string
   */
  private createSearchProductsTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Product search query (e.g., "shampoo", "batteries", "flashlight")'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return',
          default: 5
        }
      },
      required: ['query']
    };

    return {
      name: 'search_products',
      description: 'Search for products by query string',
      inputSchema,
      handler: this.handleSearchProducts.bind(this)
    };
  }

  /**
   * Get product details tool - Fetches detailed product information
   */
  private createGetProductDetailsTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'Product identifier'
        }
      },
      required: ['productId']
    };

    return {
      name: 'get_product_details',
      description: 'Get detailed information about a specific product',
      inputSchema,
      handler: this.handleGetProductDetails.bind(this)
    };
  }

  /**
   * Add to cart tool - Adds product to shopping cart
   */
  private createAddToCartTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        productId: {
          type: 'string',
          description: 'Product identifier'
        },
        quantity: {
          type: 'number',
          description: 'Quantity to add',
          default: 1
        }
      },
      required: ['userId', 'productId']
    };

    return {
      name: 'add_to_cart',
      description: 'Add product to shopping cart',
      inputSchema,
      handler: this.handleAddToCart.bind(this)
    };
  }

  /**
   * Get cart tool - Views current shopping cart contents
   */
  private createGetCartTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        }
      },
      required: ['userId']
    };

    return {
      name: 'get_cart',
      description: 'View current shopping cart contents',
      inputSchema,
      handler: this.handleGetCart.bind(this)
    };
  }

  /**
   * Update cart item tool - Updates quantity of item in cart
   */
  private createUpdateCartItemTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        productId: {
          type: 'string',
          description: 'Product identifier'
        },
        quantity: {
          type: 'number',
          description: 'New quantity (0 to remove item)'
        }
      },
      required: ['userId', 'productId', 'quantity']
    };

    return {
      name: 'update_cart_item',
      description: 'Update quantity of item in shopping cart',
      inputSchema,
      handler: this.handleUpdateCartItem.bind(this)
    };
  }

  /**
   * Remove from cart tool - Removes item from shopping cart
   */
  private createRemoveFromCartTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        productId: {
          type: 'string',
          description: 'Product identifier to remove'
        }
      },
      required: ['userId', 'productId']
    };

    return {
      name: 'remove_from_cart',
      description: 'Remove item from shopping cart',
      inputSchema,
      handler: this.handleRemoveFromCart.bind(this)
    };
  }

  /**
   * Checkout tool - Completes purchase of cart items
   */
  private createCheckoutTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        paymentMethodId: {
          type: 'string',
          description: 'Payment method ID (optional - will use default if not provided)'
        },
        shippingAddress: {
          type: 'object',
          description: 'Shipping address (optional - will use user default if not provided)',
          properties: {
            name: { type: 'string' },
            address1: { type: 'string' },
            address2: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            postalCode: { type: 'string' },
            country: { type: 'string' },
            phone: { type: 'string' }
          }
        }
      },
      required: ['userId']
    };

    return {
      name: 'checkout',
      description: 'Complete purchase of cart items',
      inputSchema,
      handler: this.handleCheckout.bind(this)
    };
  }

  /**
   * Get complementary products tool - Gets "customers also bought" products
   */
  private createGetComplementaryProductsTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'Product identifier to find complementary products for'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of complementary products to return',
          default: 3
        }
      },
      required: ['productId']
    };

    return {
      name: 'get_complementary_products',
      description: 'Get complementary products using "customers also bought" data',
      inputSchema,
      handler: this.handleGetComplementaryProducts.bind(this)
    };
  }

  /**
   * Get bundle deals tool - Gets bundle deals for products
   */
  private createGetBundleDealsTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        productIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of product IDs to find bundle deals for'
        }
      },
      required: ['productIds']
    };

    return {
      name: 'get_bundle_deals',
      description: 'Get bundle deals for bulk discounts',
      inputSchema,
      handler: this.handleGetBundleDeals.bind(this)
    };
  }

  /**
   * Handle search products request
   */
  private async handleSearchProducts(params: any): Promise<any> {
    const { query, maxResults = 5 } = params;
    
    try {
      // Check cache first
      const queryHash = productCacheRepository.generateQueryHash(query, maxResults);
      const cachedResults = await productCacheRepository.findSearchResults(queryHash);
      
      if (cachedResults) {
        return {
          success: true,
          products: cachedResults.results,
          cached: true,
          cachedAt: cachedResults.cachedAt
        };
      }

      // Search via e-commerce service
      const products = await ecommerceService.searchProducts(query, maxResults);
      
      // Cache individual products
      for (const product of products) {
        try {
          await productCacheRepository.cache({
            externalProductId: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
            currency: product.currency,
            imageUrl: product.imageUrl,
            availability: product.availability,
            estimatedDelivery: product.estimatedDelivery
          });
        } catch (error) {
          // Don't fail search if caching fails
          console.warn('Failed to cache product:', error);
        }
      }

      // Cache search results
      await productCacheRepository.cacheSearchResults(query, products);

      return {
        success: true,
        products: products,
        cached: false
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
    const { productId } = params;
    
    try {
      // Check cache first
      const cachedProduct = await productCacheRepository.findByExternalId(productId);
      
      if (cachedProduct) {
        return {
          success: true,
          product: {
            id: cachedProduct.externalProductId,
            name: cachedProduct.name,
            description: cachedProduct.description,
            price: cachedProduct.price,
            currency: cachedProduct.currency,
            imageUrl: cachedProduct.imageUrl,
            availability: cachedProduct.availability,
            estimatedDelivery: cachedProduct.estimatedDelivery,
            specifications: cachedProduct.specifications,
            reviewsSummary: cachedProduct.reviewsSummary,
            complementaryProducts: cachedProduct.complementaryProducts,
            bundleDeals: cachedProduct.bundleDeals
          },
          cached: true,
          cachedAt: cachedProduct.cachedAt
        };
      }

      // Fetch from e-commerce service
      const product = await ecommerceService.getProductDetails(productId);
      
      if (!product) {
        return {
          success: false,
          error: 'Product not found'
        };
      }

      // Cache the detailed product
      try {
        await productCacheRepository.cache({
          externalProductId: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          currency: product.currency,
          imageUrl: product.imageUrl,
          availability: product.availability,
          estimatedDelivery: product.estimatedDelivery,
          specifications: product.specifications,
          reviewsSummary: product.reviews ? {
            averageRating: product.rating,
            totalReviews: product.reviewCount,
            recentReviews: product.reviews.slice(0, 3)
          } : undefined,
          complementaryProducts: product.complementaryProducts,
          bundleDeals: product.bundleDeals
        });
      } catch (error) {
        console.warn('Failed to cache product details:', error);
      }

      return {
        success: true,
        product: product,
        cached: false
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get product details'
      };
    }
  }

  /**
   * Handle add to cart request
   */
  private async handleAddToCart(params: any): Promise<any> {
    const { userId, productId, quantity = 1 } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Get product details
      const productDetails = await this.handleGetProductDetails({ productId });
      if (!productDetails.success) {
        return {
          success: false,
          error: 'Product not found'
        };
      }

      const product = productDetails.product;

      // Create cart item
      const cartItem: CartItem = {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: quantity,
        imageUrl: product.imageUrl,
        estimatedDelivery: product.estimatedDelivery
      };

      // Add to cart
      const cart = await shoppingCartRepository.addItem(userId, cartItem);

      // Log the action
      await auditLogService.logShoppingAction({
        userId: userId,
        action: 'add_to_cart',
        productId: productId,
        quantity: quantity,
        cartTotal: cart.totalAmount
      });

      return {
        success: true,
        cart: {
          id: cart.id,
          items: cart.items,
          totalAmount: cart.totalAmount,
          currency: cart.currency,
          itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0)
        },
        addedItem: cartItem
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add item to cart'
      };
    }
  }

  /**
   * Handle get cart request
   */
  private async handleGetCart(params: any): Promise<any> {
    const { userId } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Get cart
      const cart = await shoppingCartRepository.findByUserId(userId);
      
      if (!cart) {
        return {
          success: true,
          cart: {
            items: [],
            totalAmount: 0,
            currency: 'JPY',
            itemCount: 0
          }
        };
      }

      return {
        success: true,
        cart: {
          id: cart.id,
          items: cart.items,
          totalAmount: cart.totalAmount,
          currency: cart.currency,
          itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
          expiresAt: cart.expiresAt
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get cart'
      };
    }
  }

  /**
   * Handle update cart item request
   */
  private async handleUpdateCartItem(params: any): Promise<any> {
    const { userId, productId, quantity } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Update cart item
      const cart = await shoppingCartRepository.updateItemQuantity(userId, productId, quantity);

      // Log the action
      await auditLogService.logShoppingAction({
        userId: userId,
        action: quantity > 0 ? 'update_cart_item' : 'remove_from_cart',
        productId: productId,
        quantity: quantity,
        cartTotal: cart.totalAmount
      });

      return {
        success: true,
        cart: {
          id: cart.id,
          items: cart.items,
          totalAmount: cart.totalAmount,
          currency: cart.currency,
          itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0)
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update cart item'
      };
    }
  }

  /**
   * Handle remove from cart request
   */
  private async handleRemoveFromCart(params: any): Promise<any> {
    const { userId, productId } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Remove from cart
      const cart = await shoppingCartRepository.removeItem(userId, productId);

      // Log the action
      await auditLogService.logShoppingAction({
        userId: userId,
        action: 'remove_from_cart',
        productId: productId,
        cartTotal: cart.totalAmount
      });

      return {
        success: true,
        cart: {
          id: cart.id,
          items: cart.items,
          totalAmount: cart.totalAmount,
          currency: cart.currency,
          itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0)
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove item from cart'
      };
    }
  }

  /**
   * Handle checkout request
   */
  private async handleCheckout(params: any): Promise<any> {
    const { userId, paymentMethodId, shippingAddress } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Get cart
      const cart = await shoppingCartRepository.findByUserId(userId);
      if (!cart || cart.items.length === 0) {
        return {
          success: false,
          error: 'Cart is empty'
        };
      }

      // Prepare order request
      const orderRequest = {
        items: cart.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        })),
        shippingAddress: shippingAddress || {
          name: user.name || 'Customer',
          address1: 'Default Address', // In real implementation, get from user profile
          city: 'Tokyo',
          state: 'Tokyo',
          postalCode: '100-0001',
          country: 'JP'
        },
        paymentMethodId
      };

      // Place order via e-commerce service
      const orderResult = await ecommerceService.placeOrder(orderRequest);

      // Generate reference ID for the order
      const referenceId = `FX-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      // Create order record
      const order = await orderRepository.create({
        userId: userId,
        referenceId: referenceId,
        externalOrderId: orderResult.orderId,
        status: 'paid',
        totalAmount: orderResult.total,
        currency: orderResult.currency,
        items: cart.items,
        shippingAddress: orderRequest.shippingAddress,
        trackingNumber: orderResult.trackingNumber
      });

      // Clear cart after successful order
      await shoppingCartRepository.clear(userId);

      // Log the order
      await auditLogService.logOrderPlaced({
        userId: userId,
        orderId: order.id,
        externalOrderId: orderResult.orderId,
        totalAmount: orderResult.total,
        itemCount: cart.items.length
      });

      return {
        success: true,
        order: {
          id: order.id,
          referenceId: order.referenceId,
          externalOrderId: orderResult.orderId,
          status: orderResult.status,
          totalAmount: orderResult.total,
          currency: orderResult.currency,
          trackingNumber: orderResult.trackingNumber,
          estimatedDelivery: orderResult.estimatedDelivery,
          items: cart.items
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete checkout'
      };
    }
  }

  /**
   * Handle get complementary products request
   */
  private async handleGetComplementaryProducts(params: any): Promise<any> {
    const { productId, maxResults = 3 } = params;
    
    try {
      const complementaryProducts = await ecommerceService.getComplementaryProducts(productId);
      
      return {
        success: true,
        products: complementaryProducts.slice(0, maxResults)
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get complementary products'
      };
    }
  }

  /**
   * Handle get bundle deals request
   */
  private async handleGetBundleDeals(params: any): Promise<any> {
    const { productIds } = params;
    
    try {
      const bundleDeals = await ecommerceService.getBundleDeals(productIds);
      
      return {
        success: true,
        deals: bundleDeals
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get bundle deals'
      };
    }
  }

  /**
   * Handle shopping request with AI assistance and structured outputs
   */
  private async handleShoppingRequest(params: any): Promise<any> {
    const { userId, message, conversationHistory = [] } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Get user's cart for context
      const cart = await shoppingCartRepository.findByUserId(userId);
      const cartContext = cart ? {
        items: cart.items,
        totalAmount: cart.totalAmount,
        itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0)
      } : null;

      // Build system prompt with shopping guidelines
      const systemPrompt = this.buildShoppingSystemPrompt(cartContext);
      
      // Create Gemini model with JSON schema
      const model = this.genAI.getGenerativeModel({ 
        model: config.gemini.model,
        systemInstruction: {
          role: 'system',
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: this.getShoppingResponseSchema()
        }
      });
      
      // Build conversation history for Gemini
      const chatHistory = conversationHistory.map((msg: any) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      // Start chat session with history
      const chat = model.startChat({
        history: chatHistory
      });

      // Send message and get response
      const result = await chat.sendMessage(message);
      const response = result.response;
      const aiResponseText = response.text();

      // Parse JSON response
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(aiResponseText);
      } catch (parseError) {
        console.error('Failed to parse JSON response from Gemini:', parseError);
        return {
          success: false,
          error: 'Failed to parse AI response'
        };
      }

      // Execute shopping actions based on intent
      const executionResult = await this.executeShoppingIntent(userId, parsedResponse);

      // Extract insights for processing
      const insights = parsedResponse.insights;

      // Process insights (async, don't block response)
      if (insights) {
        const { userInsightsService } = await import('../services/userInsightsService.js');
        userInsightsService.processInsights(userId, insights, `shopping-${Date.now()}`).catch(error => {
          console.error('Failed to process shopping insights:', error);
        });
      }

      // Log the shopping interaction
      await auditLogService.logMCPToolCall({
        userId,
        faxJobId: `shopping-${Date.now()}`,
        toolName: 'shopping_request',
        toolServer: 'shopping',
        input: { message },
        output: parsedResponse,
        success: true
      });

      return {
        success: true,
        intent: parsedResponse.intent,
        response: parsedResponse.response,
        products: parsedResponse.products,
        nextAction: parsedResponse.nextAction,
        metadata: parsedResponse.metadata,
        executionResult,
        insights: insights || null
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process shopping request'
      };
    }
  }

  /**
   * Execute shopping intent (search, add to cart, checkout, etc.)
   */
  private async executeShoppingIntent(userId: string, shoppingResponse: any): Promise<any> {
    const { intent, searchQuery, selectedProduct, products } = shoppingResponse;
    
    try {
      switch (intent) {
        case 'search':
          // Products are already in the response from AI
          // Optionally cache them for future reference
          if (products && products.length > 0) {
            for (const product of products) {
              if (product.productId) {
                try {
                  await productCacheRepository.cache({
                    externalProductId: product.productId,
                    name: product.name,
                    description: product.description,
                    price: product.price,
                    currency: 'JPY',
                    imageUrl: '',
                    availability: 'in_stock',
                    estimatedDelivery: product.estimatedDelivery
                  });
                } catch (error) {
                  console.warn('Failed to cache product:', error);
                }
              }
            }
          }
          return { action: 'search_completed', productCount: products?.length || 0 };

        case 'select':
          // Add selected product to cart
          if (selectedProduct) {
            const product = products?.find((p: any) => p.productId === selectedProduct);
            if (product) {
              const cartItem: CartItem = {
                productId: product.productId,
                name: product.name,
                price: product.price,
                quantity: 1,
                imageUrl: '',
                estimatedDelivery: product.estimatedDelivery
              };
              const cart = await shoppingCartRepository.addItem(userId, cartItem);
              return { 
                action: 'added_to_cart', 
                cartTotal: cart.totalAmount,
                itemCount: cart.items.length 
              };
            }
          }
          return { action: 'select_pending' };

        case 'order':
          // Checkout flow - handled separately by checkout tool
          return { action: 'order_pending', message: 'Awaiting user confirmation' };

        case 'status':
          // Order status check - would query order repository
          return { action: 'status_checked' };

        case 'clarify':
          // Need more information from user
          return { action: 'clarification_needed' };

        default:
          return { action: 'unknown_intent' };
      }
    } catch (error) {
      console.error('Failed to execute shopping intent:', error);
      return { 
        action: 'execution_failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Build shopping system prompt with context
   */
  private buildShoppingSystemPrompt(cartContext: any): string {
    const cartInfo = cartContext ? `
CURRENT CART:
- Items: ${cartContext.itemCount}
- Total: ¥${cartContext.totalAmount}
- Products: ${cartContext.items.map((item: any) => `${item.name} (¥${item.price} x ${item.quantity})`).join(', ')}
` : 'Cart is empty.';

    return `You are an AI shopping assistant for Faxi, helping elderly users in Japan shop on Amazon.co.jp via fax.

CRITICAL: You must respond with valid JSON matching the ShoppingResponseSchema.

FAX FORMATTING RULES:
- Keep responses concise (500-800 words max)
- Use short paragraphs (2-3 sentences each)
- Use bullet points for lists
- Simple, respectful language appropriate for all ages
- Clear, actionable information
- Your response will be printed and faxed to the user

SHOPPING GUIDELINES:
- Show 3-5 products maximum per search
- All prices in Japanese Yen (¥)
- Highlight Prime-eligible products with ★ Prime
- Include estimated delivery times
- Always confirm address and payment before ordering
- Never order without explicit user confirmation

${cartInfo}

INSIGHTS EXTRACTION:
Extract consumer behavior insights from every interaction:

CONSUMER PROFILE:
- Spend sensitivity: value (budget-conscious), normal, premium (quality-focused)
- Brand preferences: specific brands mentioned
- Category preferences: types of products interested in

INTENT SIGNALS:
- Commercial intent: what they're shopping for, urgency level
- Price range: budget constraints or flexibility

LIFE EVENTS:
- Moving: furniture, appliances, home goods
- Gift giving: birthday, celebration mentions
- Health changes: assistive devices, medical supplies

BEHAVIORAL:
- Communication style: detailed vs. brief requests
- Task complexity: simple product vs. complex comparison

DIGITAL PROFILE:
- Digital exclusion score (1-5): 5=cannot search online themselves
- Assistance needs: product research, price comparison, ordering

PRIVACY RULES:
- NO specific product names in insights (use categories)
- NO exact prices in insights (use ranges)
- Only include insights with confidence > 0.6

Your response must be valid JSON matching the ShoppingResponseSchema.`;
  }

  /**
   * Get Shopping response JSON schema for Gemini
   */
  private getShoppingResponseSchema(): any {
    return {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: ['search', 'select', 'order', 'status', 'clarify'],
          description: "User's shopping intent"
        },
        searchQuery: {
          type: 'string',
          description: 'Product search query'
        },
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              price: { type: 'number' },
              description: { type: 'string' },
              productId: { type: 'string' },
              isPrime: { type: 'boolean' },
              estimatedDelivery: { type: 'string' }
            },
            required: ['name', 'price', 'description']
          },
          description: 'Product search results (3-5 products)'
        },
        selectedProduct: {
          type: 'string',
          description: 'Product ID if user selected a specific product'
        },
        deliveryAddress: {
          type: 'object',
          properties: {
            needsConfirmation: { type: 'boolean' },
            suggestedAddress: { type: 'string' }
          }
        },
        paymentMethod: {
          type: 'object',
          properties: {
            needsSelection: { type: 'boolean' },
            availableMethods: { type: 'array', items: { type: 'string' } }
          }
        },
        response: {
          type: 'string',
          description: 'Human-readable response for fax'
        },
        nextAction: {
          type: 'string',
          enum: ['show_products', 'confirm_order', 'request_payment', 'complete', 'clarify']
        },
        metadata: {
          type: 'object',
          properties: {
            totalAmount: { type: 'number' },
            itemCount: { type: 'number' },
            orderReference: { type: 'string' }
          }
        },
        insights: {
          type: 'object',
          description: 'Strategic user insights',
          properties: {
            demographics: {
              type: 'object',
              properties: {
                ageRangeInferred: { type: 'string', enum: ['60-69', '70-79', '80+', 'unknown'] },
                genderInferred: { type: 'string', enum: ['male', 'female', 'unknown'] },
                regionInferred: { type: 'string' },
                householdTypeInferred: { type: 'string', enum: ['single', 'couple', 'multi-gen', 'unknown'] }
              }
            },
            lifeEvents: {
              type: 'object',
              properties: {
                movingDetected: { type: 'boolean' },
                newCaregiverDetected: { type: 'boolean' },
                deathInFamilyDetected: { type: 'boolean' },
                hospitalizationDetected: { type: 'boolean' },
                retirementDetected: { type: 'boolean' }
              }
            },
            intentSignals: {
              type: 'object',
              properties: {
                commercialIntent: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      category: { type: 'string' },
                      product: { type: 'string' },
                      priceRange: {
                        type: 'object',
                        properties: {
                          min: { type: 'number' },
                          max: { type: 'number' }
                        }
                      },
                      urgency: { type: 'string', enum: ['immediate', 'near-term', 'long-term'] }
                    },
                    required: ['category', 'urgency']
                  }
                }
              }
            },
            behavioral: {
              type: 'object',
              properties: {
                communicationStyle: { type: 'string', enum: ['short', 'long', 'polite', 'direct', 'detailed'] },
                taskComplexity: { type: 'string', enum: ['simple', 'moderate', 'complex'] }
              }
            },
            consumerProfile: {
              type: 'object',
              properties: {
                spendSensitivity: { type: 'string', enum: ['value', 'normal', 'premium'] },
                brandMentions: { type: 'array', items: { type: 'string' } },
                categoryPreference: { type: 'string' }
              }
            },
            digitalProfile: {
              type: 'object',
              properties: {
                digitalExclusionScore: { type: 'number', minimum: 1, maximum: 5 },
                aiAssistanceNeeded: { type: 'array', items: { type: 'string' } }
              }
            },
            confidenceScores: {
              type: 'object',
              properties: {
                demographics: { type: 'number', minimum: 0, maximum: 1 },
                lifeEvents: { type: 'number', minimum: 0, maximum: 1 },
                intent: { type: 'number', minimum: 0, maximum: 1 }
              }
            }
          }
        }
      },
      required: ['intent', 'response']
    };
  }
}

// Export singleton instance
export const shoppingMCPServer = new ShoppingMCPServer();