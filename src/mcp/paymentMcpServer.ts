import Stripe from 'stripe';
import { MCPServer, MCPTool } from '../types/agent';
import { paymentMethodRepository, PaymentMethod } from '../repositories/paymentMethodRepository';
import { userRepository } from '../repositories/userRepository';
import { auditLogService } from '../services/auditLogService';
import { config } from '../config';

/**
 * Payment MCP Server - Provides payment processing tools to the MCP Controller Agent
 * 
 * This server handles:
 * - Payment method management (credit cards, convenience store payments)
 * - Payment processing via Stripe
 * - Konbini barcode generation for convenience store payments
 * - Payment status checking and confirmation
 * - PCI-compliant payment handling
 */
export class PaymentMCPServer implements MCPServer {
  name = 'payment';
  description = 'Payment processing and management tools';
  tools: MCPTool[] = [];
  private stripe: Stripe;

  constructor() {
    // Initialize Stripe with secret key
    this.stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2025-10-29.clover',
    });
    
    this.initializeTools();
  }

  private initializeTools(): void {
    this.tools = [
      this.createGetPaymentMethodsTool(),
      this.createRegisterPaymentMethodTool(),
      this.createProcessPaymentTool(),
      this.createGenerateKonbiniBarcodeToool(),
      this.createCheckPaymentStatusTool(),
    ];
  }

  /**
   * Get payment methods tool - Lists user's registered payment methods
   */
  private createGetPaymentMethodsTool(): MCPTool {
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
      name: 'get_payment_methods',
      description: 'List user\'s registered payment methods',
      inputSchema,
      handler: this.handleGetPaymentMethods.bind(this)
    };
  }

  /**
   * Register payment method tool - Adds new payment method for user
   */
  private createRegisterPaymentMethodTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        paymentMethodId: {
          type: 'string',
          description: 'Stripe payment method ID (from client-side tokenization)'
        },
        setAsDefault: {
          type: 'boolean',
          description: 'Whether to set this as the default payment method',
          default: false
        }
      },
      required: ['userId', 'paymentMethodId']
    };

    return {
      name: 'register_payment_method',
      description: 'Add new payment method for user',
      inputSchema,
      handler: this.handleRegisterPaymentMethod.bind(this)
    };
  }

  /**
   * Process payment tool - Charges payment method using Stripe
   */
  private createProcessPaymentTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        amount: {
          type: 'number',
          description: 'Payment amount in smallest currency unit (e.g., yen for JPY)'
        },
        currency: {
          type: 'string',
          description: 'Currency code (e.g., JPY, USD)',
          default: 'JPY'
        },
        paymentMethodId: {
          type: 'string',
          description: 'Payment method ID (optional - uses default if not provided)'
        },
        description: {
          type: 'string',
          description: 'Payment description for records'
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata for the payment'
        }
      },
      required: ['userId', 'amount', 'description']
    };

    return {
      name: 'process_payment',
      description: 'Charge payment method using Stripe',
      inputSchema,
      handler: this.handleProcessPayment.bind(this)
    };
  }

  /**
   * Generate konbini barcode tool - Creates convenience store payment barcode
   */
  private createGenerateKonbiniBarcodeToool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        amount: {
          type: 'number',
          description: 'Payment amount in smallest currency unit (e.g., yen for JPY)'
        },
        currency: {
          type: 'string',
          description: 'Currency code (e.g., JPY)',
          default: 'JPY'
        },
        description: {
          type: 'string',
          description: 'Payment description'
        },
        expiresInDays: {
          type: 'number',
          description: 'Number of days until barcode expires',
          default: 7
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata for the payment'
        }
      },
      required: ['userId', 'amount', 'description']
    };

    return {
      name: 'generate_konbini_barcode',
      description: 'Create Stripe Konbini payment intent for convenience store payment',
      inputSchema,
      handler: this.handleGenerateKonbiniBarcode.bind(this)
    };
  }

  /**
   * Check payment status tool - Queries payment status by transaction ID
   */
  private createCheckPaymentStatusTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        paymentIntentId: {
          type: 'string',
          description: 'Stripe payment intent ID'
        }
      },
      required: ['paymentIntentId']
    };

    return {
      name: 'check_payment_status',
      description: 'Query payment status by transaction ID',
      inputSchema,
      handler: this.handleCheckPaymentStatus.bind(this)
    };
  }

  /**
   * Handle get payment methods request
   */
  private async handleGetPaymentMethods(params: any): Promise<any> {
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

      // Get payment methods from database
      const paymentMethods = await paymentMethodRepository.findByUserId(userId);

      return {
        success: true,
        paymentMethods: paymentMethods.map(pm => ({
          id: pm.id,
          type: pm.type,
          last4: pm.last4,
          brand: pm.brand,
          isDefault: pm.isDefault,
          createdAt: pm.createdAt
        })),
        hasDefault: paymentMethods.some(pm => pm.isDefault)
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get payment methods'
      };
    }
  }

  /**
   * Handle register payment method request
   */
  private async handleRegisterPaymentMethod(params: any): Promise<any> {
    const { userId, paymentMethodId, setAsDefault = false } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Get or create Stripe customer
      let stripeCustomerId = user.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await this.stripe.customers.create({
          email: user.emailAddress,
          phone: user.phoneNumber || undefined,
          metadata: {
            userId: userId,
            faxiUser: 'true'
          }
        });
        stripeCustomerId = customer.id;
        
        // Update user with Stripe customer ID
        await userRepository.update(userId, { stripeCustomerId });
      }

      // Retrieve payment method from Stripe
      const stripePaymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);
      
      // Attach payment method to customer
      await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId,
      });

      // Determine payment method details
      let type: 'card' | 'konbini' = 'card';
      let last4: string | null = null;
      let brand: string | null = null;

      if (stripePaymentMethod.card) {
        type = 'card';
        last4 = stripePaymentMethod.card.last4;
        brand = stripePaymentMethod.card.brand;
      } else if (stripePaymentMethod.konbini) {
        type = 'konbini';
      }

      // Check if this is the first payment method (auto-default)
      const existingMethods = await paymentMethodRepository.findByUserId(userId);
      const shouldSetDefault = setAsDefault || existingMethods.length === 0;

      // Store payment method in database
      const paymentMethod = await paymentMethodRepository.create({
        userId,
        stripePaymentMethodId: paymentMethodId,
        type,
        last4: last4 || undefined,
        brand: brand || undefined,
        isDefault: shouldSetDefault
      });

      // Log the registration
      await auditLogService.logPaymentMethodRegistered({
        userId,
        paymentMethodId: paymentMethod.id,
        type,
        isDefault: shouldSetDefault
      });

      return {
        success: true,
        paymentMethod: {
          id: paymentMethod.id,
          type: paymentMethod.type,
          last4: paymentMethod.last4,
          brand: paymentMethod.brand,
          isDefault: paymentMethod.isDefault,
          createdAt: paymentMethod.createdAt
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to register payment method'
      };
    }
  }

  /**
   * Handle process payment request
   */
  private async handleProcessPayment(params: any): Promise<any> {
    const { userId, amount, currency = 'JPY', paymentMethodId, description, metadata = {} } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Get payment method
      let paymentMethod: PaymentMethod | null = null;
      if (paymentMethodId) {
        paymentMethod = await paymentMethodRepository.findById(paymentMethodId);
        if (!paymentMethod || paymentMethod.userId !== userId) {
          return {
            success: false,
            error: 'Payment method not found or access denied'
          };
        }
      } else {
        // Use default payment method
        paymentMethod = await paymentMethodRepository.findDefaultByUserId(userId);
        if (!paymentMethod) {
          return {
            success: false,
            error: 'No default payment method found. Please register a payment method first.'
          };
        }
      }

      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency: currency.toLowerCase(),
        customer: user.stripeCustomerId || undefined,
        payment_method: paymentMethod.stripePaymentMethodId,
        description,
        metadata: {
          userId,
          faxiPayment: 'true',
          ...metadata
        },
        confirm: true,
        return_url: `${config.baseUrl}/payment/return`, // For 3D Secure if needed
      });

      // Log the payment attempt
      await auditLogService.logPaymentProcessed({
        userId,
        paymentIntentId: paymentIntent.id,
        amount,
        currency,
        status: paymentIntent.status,
        paymentMethodId: paymentMethod.id
      });

      return {
        success: paymentIntent.status === 'succeeded',
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          description: paymentIntent.description,
          clientSecret: paymentIntent.client_secret // For 3D Secure handling
        },
        requiresAction: paymentIntent.status === 'requires_action',
        nextAction: paymentIntent.next_action
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process payment'
      };
    }
  }

  /**
   * Handle generate konbini barcode request
   */
  private async handleGenerateKonbiniBarcode(params: any): Promise<any> {
    const { userId, amount, currency = 'JPY', description, expiresInDays = 7, metadata = {} } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Calculate expiration date
      const expiresAt = Math.floor(Date.now() / 1000) + (expiresInDays * 24 * 60 * 60);

      // Create payment intent with konbini payment method
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount,
        currency: currency.toLowerCase(),
        payment_method_types: ['konbini'],
        description,
        metadata: {
          userId,
          faxiKonbiniPayment: 'true',
          expiresInDays: expiresInDays.toString(),
          ...metadata
        },
        payment_method_options: {
          konbini: {
            expires_after_days: expiresInDays
          }
        }
      });

      // Log the barcode generation
      await auditLogService.logKonbiniBarcodeGenerated({
        userId,
        paymentIntentId: paymentIntent.id,
        amount,
        currency,
        expiresAt: new Date(expiresAt * 1000)
      });

      return {
        success: true,
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          description: paymentIntent.description,
          clientSecret: paymentIntent.client_secret
        },
        konbini: {
          confirmationNumber: paymentIntent.id, // Use payment intent ID as confirmation number
          expiresAt: new Date(expiresAt * 1000),
          instructions: 'Take this barcode to any FamilyMart, 7-Eleven, or Lawson convenience store to complete payment.',
          stores: ['FamilyMart', '7-Eleven', 'Lawson']
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate konbini barcode'
      };
    }
  }

  /**
   * Handle check payment status request
   */
  private async handleCheckPaymentStatus(params: any): Promise<any> {
    const { paymentIntentId } = params;
    
    try {
      // Retrieve payment intent from Stripe
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      return {
        success: true,
        payment: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          description: paymentIntent.description,
          created: new Date(paymentIntent.created * 1000),
          metadata: paymentIntent.metadata
        },
        isPaid: paymentIntent.status === 'succeeded',
        isPending: ['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'].includes(paymentIntent.status),
        isFailed: ['requires_payment_method', 'canceled'].includes(paymentIntent.status) && paymentIntent.last_payment_error
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check payment status'
      };
    }
  }
}

// Export singleton instance
export const paymentMCPServer = new PaymentMCPServer();