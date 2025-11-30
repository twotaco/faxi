/**
 * Gemini Tool Definitions
 *
 * Converts MCP tool schemas to Gemini function declarations for native tool calling.
 * These definitions are used by geminiAgentService to let Gemini intelligently
 * decide which tool to call and extract proper parameters from user requests.
 */

import { FunctionDeclaration, SchemaType } from '@google/generative-ai';

/**
 * Shopping Tools - Product search and order management
 */
export const shoppingTools: FunctionDeclaration[] = [
  {
    name: 'shopping_search_products',
    description: 'Search for products on Amazon Japan. Use this when the user wants to buy something, search for products, or shop online.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: {
          type: SchemaType.STRING,
          description: 'Product search query - extract the item name the user wants to find (e.g., "shampoo", "headphones", "rice cooker")'
        },
        maxPrice: {
          type: SchemaType.NUMBER,
          description: 'Maximum price in Japanese Yen (JPY) if user specified a budget'
        },
        minPrice: {
          type: SchemaType.NUMBER,
          description: 'Minimum price in Japanese Yen (JPY) if specified'
        },
        primeOnly: {
          type: SchemaType.BOOLEAN,
          description: 'Only show Prime-eligible products. Default true for faster delivery.'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'shopping_create_order',
    description: 'Create an order for a selected product. Use this when user has selected a specific product to purchase.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        productId: {
          type: SchemaType.STRING,
          description: 'Product ASIN or ID to order'
        },
        quantity: {
          type: SchemaType.NUMBER,
          description: 'Quantity to order. Default 1.'
        }
      },
      required: ['productId']
    }
  }
];

/**
 * Email Tools - Sending emails and managing contacts
 */
export const emailTools: FunctionDeclaration[] = [
  {
    name: 'email_send',
    description: 'Send an email to someone. Use this when the user wants to email, contact, write to, or message someone.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        recipientEmail: {
          type: SchemaType.STRING,
          description: 'Email address of the recipient (e.g., john@example.com)'
        },
        recipientName: {
          type: SchemaType.STRING,
          description: 'Name of the recipient if no email address provided - will look up in address book'
        },
        subject: {
          type: SchemaType.STRING,
          description: 'Email subject line'
        },
        body: {
          type: SchemaType.STRING,
          description: 'Email message body content'
        }
      },
      required: ['body']
    }
  },
  {
    name: 'email_lookup_contact',
    description: 'Look up a contact in the address book by name to find their email address.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        name: {
          type: SchemaType.STRING,
          description: 'Name of the contact to look up'
        }
      },
      required: ['name']
    }
  }
];

/**
 * AI Chat Tools - General questions and information
 */
export const aiChatTools: FunctionDeclaration[] = [
  {
    name: 'ai_chat_question',
    description: 'Ask a question or get information. Use this for general questions, factual queries, advice requests, or any informational need.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        question: {
          type: SchemaType.STRING,
          description: 'The question or topic the user wants to know about'
        },
        context: {
          type: SchemaType.STRING,
          description: 'Additional context that might help answer the question'
        }
      },
      required: ['question']
    }
  }
];

/**
 * Payment Tools - Payment method registration and management
 */
export const paymentTools: FunctionDeclaration[] = [
  {
    name: 'payment_register',
    description: 'Register a new payment method. Use when user wants to add a credit card, set up payments, or register payment information.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        methodType: {
          type: SchemaType.STRING,
          description: 'Type of payment method: "credit_card", "bank_transfer", or "convenience_store"'
        }
      },
      required: ['methodType']
    }
  },
  {
    name: 'payment_check_status',
    description: 'Check the status of a payment or order.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        orderId: {
          type: SchemaType.STRING,
          description: 'Order ID or reference number to check'
        }
      },
      required: ['orderId']
    }
  }
];

/**
 * Clarification Tool - Request more information from user
 */
export const clarificationTools: FunctionDeclaration[] = [
  {
    name: 'request_clarification',
    description: 'Request clarification when the user intent is unclear or more information is needed. Use this when you cannot determine what the user wants.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        possibleIntents: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'List of possible things the user might want to do'
        },
        clarificationQuestion: {
          type: SchemaType.STRING,
          description: 'Specific question to ask the user for clarification'
        }
      },
      required: ['clarificationQuestion']
    }
  }
];

/**
 * All tools combined for Gemini function calling
 */
export const allGeminiTools: FunctionDeclaration[] = [
  ...shoppingTools,
  ...emailTools,
  ...aiChatTools,
  ...paymentTools,
  ...clarificationTools
];

/**
 * Tool name to MCP server mapping
 */
export const toolToServerMap: Record<string, string> = {
  'shopping_search_products': 'shopping',
  'shopping_create_order': 'shopping',
  'email_send': 'email',
  'email_lookup_contact': 'email',
  'ai_chat_question': 'ai_chat',
  'payment_register': 'payment',
  'payment_check_status': 'payment',
  'request_clarification': 'clarification'
};

/**
 * Tool name to MCP tool name mapping (Gemini name -> MCP tool name)
 */
export const toolNameMap: Record<string, string> = {
  'shopping_search_products': 'search_products',
  'shopping_create_order': 'create_order',
  'email_send': 'send_email',
  'email_lookup_contact': 'lookup_contact',
  'ai_chat_question': 'chat',
  'payment_register': 'register_payment_method',
  'payment_check_status': 'check_payment_status'
};
