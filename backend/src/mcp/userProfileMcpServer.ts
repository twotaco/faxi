import { MCPServer, MCPTool } from '../types/agent';
import { userRepository, User } from '../repositories/userRepository';
import { addressBookRepository, AddressBookEntry } from '../repositories/addressBookRepository';
import { orderRepository, Order } from '../repositories/orderRepository';
import { auditLogService } from '../services/auditLogService';
import { ecommerceService } from '../services/ecommerceService';

/**
 * User Profile MCP Server - Provides user profile and data management tools
 * 
 * This server handles:
 * - User profile information retrieval and updates
 * - Delivery address management
 * - Address book management (contacts)
 * - Order history and tracking
 * - User preferences and settings
 */
export class UserProfileMCPServer implements MCPServer {
  name = 'user_profile';
  description = 'User profile and data management tools';
  tools: MCPTool[] = [];

  constructor() {
    this.initializeTools();
  }

  private initializeTools(): void {
    this.tools = [
      // Profile management tools
      this.createGetUserProfileTool(),
      this.createUpdateDeliveryAddressTool(),
      
      // Address book management tools
      this.createGetAddressBookTool(),
      this.createAddContactTool(),
      this.createUpdateContactTool(),
      this.createDeleteContactTool(),
      this.createLookupContactTool(),
      
      // Order management tools
      this.createGetOrderHistoryTool(),
      this.createTrackOrderTool(),
    ];
  }

  /**
   * Get user profile tool - Retrieves user information
   */
  private createGetUserProfileTool(): MCPTool {
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
      name: 'get_user_profile',
      description: 'Retrieve user profile information including contact details and preferences',
      inputSchema,
      handler: this.handleGetUserProfile.bind(this)
    };
  }

  /**
   * Update delivery address tool - Updates user's shipping address
   */
  private createUpdateDeliveryAddressTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        name: {
          type: 'string',
          description: 'Full name for delivery'
        },
        address1: {
          type: 'string',
          description: 'Primary address line'
        },
        address2: {
          type: 'string',
          description: 'Secondary address line (optional)'
        },
        city: {
          type: 'string',
          description: 'City'
        },
        state: {
          type: 'string',
          description: 'State or prefecture'
        },
        postalCode: {
          type: 'string',
          description: 'Postal code'
        },
        country: {
          type: 'string',
          description: 'Country code (e.g., JP, US)',
          default: 'JP'
        },
        phone: {
          type: 'string',
          description: 'Phone number for delivery (optional)'
        }
      },
      required: ['userId', 'name', 'address1', 'city', 'state', 'postalCode']
    };

    return {
      name: 'update_delivery_address',
      description: 'Update user\'s delivery address for shipping',
      inputSchema,
      handler: this.handleUpdateDeliveryAddress.bind(this)
    };
  }

  /**
   * Get address book tool - Lists all contacts
   */
  private createGetAddressBookTool(): MCPTool {
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
      name: 'get_address_book',
      description: 'Retrieve user\'s address book contacts',
      inputSchema,
      handler: this.handleGetAddressBook.bind(this)
    };
  }

  /**
   * Add contact tool - Manually adds new contact
   */
  private createAddContactTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        name: {
          type: 'string',
          description: 'Contact name'
        },
        email: {
          type: 'string',
          description: 'Contact email address'
        },
        relationship: {
          type: 'string',
          description: 'Relationship to user (e.g., son, friend, doctor)'
        },
        notes: {
          type: 'string',
          description: 'Additional notes about the contact'
        }
      },
      required: ['userId', 'name', 'email']
    };

    return {
      name: 'add_contact',
      description: 'Add new contact to address book',
      inputSchema,
      handler: this.handleAddContact.bind(this)
    };
  }

  /**
   * Update contact tool - Modifies existing contact details
   */
  private createUpdateContactTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        contactId: {
          type: 'string',
          description: 'Contact ID to update'
        },
        name: {
          type: 'string',
          description: 'Updated contact name'
        },
        email: {
          type: 'string',
          description: 'Updated email address'
        },
        relationship: {
          type: 'string',
          description: 'Updated relationship'
        },
        notes: {
          type: 'string',
          description: 'Updated notes'
        }
      },
      required: ['userId', 'contactId']
    };

    return {
      name: 'update_contact',
      description: 'Update existing contact details',
      inputSchema,
      handler: this.handleUpdateContact.bind(this)
    };
  }

  /**
   * Delete contact tool - Removes contact from address book
   */
  private createDeleteContactTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        contactId: {
          type: 'string',
          description: 'Contact ID to delete'
        }
      },
      required: ['userId', 'contactId']
    };

    return {
      name: 'delete_contact',
      description: 'Delete contact from address book',
      inputSchema,
      handler: this.handleDeleteContact.bind(this)
    };
  }

  /**
   * Lookup contact tool - Finds contact by name or relationship
   */
  private createLookupContactTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        query: {
          type: 'string',
          description: 'Name or relationship to search for'
        }
      },
      required: ['userId', 'query']
    };

    return {
      name: 'lookup_contact',
      description: 'Find contact by name or relationship',
      inputSchema,
      handler: this.handleLookupContact.bind(this)
    };
  }

  /**
   * Get order history tool - Views past orders
   */
  private createGetOrderHistoryTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of orders to return',
          default: 20
        }
      },
      required: ['userId']
    };

    return {
      name: 'get_order_history',
      description: 'Retrieve user\'s order history',
      inputSchema,
      handler: this.handleGetOrderHistory.bind(this)
    };
  }

  /**
   * Track order tool - Gets order status and tracking information
   */
  private createTrackOrderTool(): MCPTool {
    const inputSchema = {
      type: 'object',
      properties: {
        userId: {
          type: 'string',
          description: 'User ID'
        },
        orderId: {
          type: 'string',
          description: 'Order ID to track (can be internal ID or external order ID)'
        }
      },
      required: ['userId', 'orderId']
    };

    return {
      name: 'track_order',
      description: 'Get order status and tracking information',
      inputSchema,
      handler: this.handleTrackOrder.bind(this)
    };
  }

  /**
   * Handle get user profile request
   */
  private async handleGetUserProfile(params: any): Promise<any> {
    const { userId } = params;
    
    try {
      // Get user information
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Get user's delivery address from most recent order
      let deliveryAddress = null;
      const recentOrders = await orderRepository.findByUserId(userId, 1);
      if (recentOrders.length > 0 && recentOrders[0].shippingAddress) {
        deliveryAddress = recentOrders[0].shippingAddress;
      }

      // Get contact count
      const contacts = await addressBookRepository.findByUserId(userId);

      return {
        success: true,
        profile: {
          id: user.id,
          phoneNumber: user.phoneNumber,
          emailAddress: user.emailAddress,
          name: user.name,
          hasStripeCustomer: !!user.stripeCustomerId,
          deliveryAddress: deliveryAddress,
          contactCount: contacts.length,
          memberSince: user.createdAt,
          lastUpdated: user.updatedAt
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve user profile'
      };
    }
  }

  /**
   * Handle update delivery address request
   */
  private async handleUpdateDeliveryAddress(params: any): Promise<any> {
    const { userId, name, address1, address2, city, state, postalCode, country = 'JP', phone } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Create delivery address object
      const deliveryAddress = {
        name,
        address1,
        address2: address2 || null,
        city,
        state,
        postalCode,
        country,
        phone: phone || user.phoneNumber
      };

      // Update user's name if provided and different
      if (name && name !== user.name) {
        await userRepository.update(userId, { name });
      }

      // Log the address update
      await auditLogService.logUserProfileUpdated({
        userId,
        field: 'delivery_address',
        oldValue: null, // We don't store previous addresses
        newValue: deliveryAddress
      });

      return {
        success: true,
        deliveryAddress,
        message: 'Delivery address updated successfully'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update delivery address'
      };
    }
  }

  /**
   * Handle get address book request
   */
  private async handleGetAddressBook(params: any): Promise<any> {
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

      // Get all contacts
      const contacts = await addressBookRepository.findByUserId(userId);
      
      return {
        success: true,
        contacts: contacts.map(contact => ({
          id: contact.id,
          name: contact.name,
          email: contact.emailAddress,
          relationship: contact.relationship,
          notes: contact.notes,
          createdAt: contact.createdAt,
          updatedAt: contact.updatedAt
        })),
        totalCount: contacts.length
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve address book'
      };
    }
  }

  /**
   * Handle add contact request
   */
  private async handleAddContact(params: any): Promise<any> {
    const { userId, name, email, relationship, notes } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Check if contact already exists
      const existingContact = await addressBookRepository.findByUserAndEmail(userId, email);
      if (existingContact) {
        return {
          success: false,
          error: `Contact with email ${email} already exists`,
          existingContact: {
            id: existingContact.id,
            name: existingContact.name,
            email: existingContact.emailAddress,
            relationship: existingContact.relationship
          }
        };
      }

      // Create new contact
      const contact = await addressBookRepository.create({
        userId,
        name,
        emailAddress: email,
        relationship,
        notes
      });

      // Log the contact addition
      await auditLogService.logContactAdded({
        userId,
        contactId: contact.id,
        name: contact.name,
        emailAddress: contact.emailAddress
      });
      
      return {
        success: true,
        contact: {
          id: contact.id,
          name: contact.name,
          email: contact.emailAddress,
          relationship: contact.relationship,
          notes: contact.notes,
          createdAt: contact.createdAt
        },
        message: 'Contact added successfully'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add contact'
      };
    }
  }

  /**
   * Handle update contact request
   */
  private async handleUpdateContact(params: any): Promise<any> {
    const { userId, contactId, name, email, relationship, notes } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Verify contact exists and belongs to user
      const existingContact = await addressBookRepository.findById(contactId);
      if (!existingContact || existingContact.userId !== userId) {
        return {
          success: false,
          error: 'Contact not found or access denied'
        };
      }

      // Prepare update data
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.emailAddress = email;
      if (relationship !== undefined) updateData.relationship = relationship;
      if (notes !== undefined) updateData.notes = notes;

      // Check if email is being changed and if it conflicts with existing contact
      if (email && email !== existingContact.emailAddress) {
        const conflictingContact = await addressBookRepository.findByUserAndEmail(userId, email);
        if (conflictingContact && conflictingContact.id !== contactId) {
          return {
            success: false,
            error: `Another contact with email ${email} already exists`
          };
        }
      }

      // Update contact
      const updatedContact = await addressBookRepository.update(contactId, updateData);

      // Log the contact update
      await auditLogService.logContactUpdated({
        userId,
        contactId,
        changes: updateData
      });
      
      return {
        success: true,
        contact: {
          id: updatedContact.id,
          name: updatedContact.name,
          email: updatedContact.emailAddress,
          relationship: updatedContact.relationship,
          notes: updatedContact.notes,
          updatedAt: updatedContact.updatedAt
        },
        message: 'Contact updated successfully'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update contact'
      };
    }
  }

  /**
   * Handle delete contact request
   */
  private async handleDeleteContact(params: any): Promise<any> {
    const { userId, contactId } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Verify contact exists and belongs to user
      const existingContact = await addressBookRepository.findById(contactId);
      if (!existingContact || existingContact.userId !== userId) {
        return {
          success: false,
          error: 'Contact not found or access denied'
        };
      }

      // Delete contact
      await addressBookRepository.delete(contactId);

      // Log the contact deletion
      await auditLogService.logContactDeleted({
        userId,
        contactId,
        name: existingContact.name,
        emailAddress: existingContact.emailAddress
      });
      
      return {
        success: true,
        message: `Contact "${existingContact.name}" deleted successfully`
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete contact'
      };
    }
  }

  /**
   * Handle lookup contact request
   */
  private async handleLookupContact(params: any): Promise<any> {
    const { userId, query } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Search contacts
      const contacts = await addressBookRepository.searchByNameOrRelationship(userId, query);
      
      return {
        success: true,
        contacts: contacts.map(contact => ({
          id: contact.id,
          name: contact.name,
          email: contact.emailAddress,
          relationship: contact.relationship,
          notes: contact.notes
        })),
        query,
        resultCount: contacts.length
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to lookup contact'
      };
    }
  }

  /**
   * Handle get order history request
   */
  private async handleGetOrderHistory(params: any): Promise<any> {
    const { userId, limit = 20 } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Get order history
      const orders = await orderRepository.findByUserId(userId, limit);
      
      return {
        success: true,
        orders: orders.map(order => ({
          id: order.id,
          referenceId: order.referenceId,
          externalOrderId: order.externalOrderId,
          status: order.status,
          totalAmount: order.totalAmount,
          currency: order.currency,
          items: order.items,
          trackingNumber: order.trackingNumber,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt
        })),
        totalCount: orders.length
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve order history'
      };
    }
  }

  /**
   * Handle track order request
   */
  private async handleTrackOrder(params: any): Promise<any> {
    const { userId, orderId } = params;
    
    try {
      // Verify user exists
      const user = await userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Find order by ID or external order ID
      let order = await orderRepository.findById(orderId);
      if (!order) {
        order = await orderRepository.findByExternalOrderId(orderId);
      }
      if (!order) {
        order = await orderRepository.findByReferenceId(orderId);
      }

      if (!order) {
        return {
          success: false,
          error: 'Order not found'
        };
      }

      // Verify order belongs to user
      if (order.userId !== userId) {
        return {
          success: false,
          error: 'Access denied to order'
        };
      }

      // Get updated tracking information from e-commerce service if available
      let trackingInfo = null;
      if (order.externalOrderId) {
        try {
          trackingInfo = await ecommerceService.getOrderStatus(order.externalOrderId);
        } catch (error) {
          // Continue with database info if external service fails
          console.warn('Failed to get external tracking info:', error);
        }
      }

      return {
        success: true,
        order: {
          id: order.id,
          referenceId: order.referenceId,
          externalOrderId: order.externalOrderId,
          status: trackingInfo?.status || order.status,
          totalAmount: order.totalAmount,
          currency: order.currency,
          items: order.items,
          trackingNumber: trackingInfo?.trackingNumber || order.trackingNumber,
          estimatedDelivery: trackingInfo?.estimatedDelivery,
          shippingAddress: order.shippingAddress,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt
        },
        tracking: trackingInfo ? {
          currentStatus: trackingInfo.status,
          trackingNumber: trackingInfo.trackingNumber,
          estimatedDelivery: trackingInfo.estimatedDelivery,
          lastUpdated: new Date().toISOString()
        } : null
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to track order'
      };
    }
  }
}

// Export singleton instance
export const userProfileMCPServer = new UserProfileMCPServer();