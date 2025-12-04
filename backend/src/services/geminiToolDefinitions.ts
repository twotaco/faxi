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
        // primeOnly is enforced server-side - not exposed to AI
        // All products must be Prime-eligible with free shipping
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

/**
 * Execution Plan Types - For multi-step orchestration
 */

export interface StepCondition {
  /** The step ID whose result to check */
  step: string;
  /** The type of check to perform */
  check: 'contains' | 'not_contains' | 'equals' | 'not_equals' | 'truthy' | 'falsy';
  /** The value to check against (for contains/equals checks) */
  value?: string;
  /** Field path in the result to check (defaults to response text) */
  field?: string;
}

export interface ExecutionStep {
  /** Unique identifier for this step */
  id: string;
  /** The tool to call (must match a key in toolToServerMap) */
  tool: string;
  /** Parameters to pass to the tool */
  params: Record<string, any>;
  /** Human-readable description of what this step does */
  description: string;
  /** Step IDs that must complete before this step runs */
  dependsOn?: string[];
  /** Optional condition that must be met for this step to execute */
  condition?: StepCondition;
}

export interface ExecutionPlan {
  /** Array of steps to execute */
  steps: ExecutionStep[];
  /** Optional summary of what the plan accomplishes */
  summary?: string;
}

/**
 * List of available tools for the planner prompt
 */
export const availableToolsList = `
AVAILABLE TOOLS:
- ai_chat_question: Ask questions, get information, weather, recommendations, advice
  params: { question: string, context?: string }

- shopping_search_products: Search for products on Amazon Japan
  params: { query: string, maxPrice?: number, minPrice?: number, primeOnly?: boolean }

- shopping_create_order: Create an order for a product
  params: { productId: string, quantity?: number }

- email_send: Send an email to someone
  params: { recipientEmail?: string, recipientName?: string, subject?: string, body: string }

- email_lookup_contact: Look up a contact's email address
  params: { name: string }

- payment_register: Register a payment method
  params: { methodType: "credit_card" | "bank_transfer" | "convenience_store" }

- payment_check_status: Check payment/order status
  params: { orderId: string }
`;

/**
 * Planner System Instruction - Guides Gemini to create execution plans
 */
export const PLANNER_SYSTEM_INSTRUCTION = `You are Faxi's request planner. Your job is to analyze user requests and create execution plans that orchestrate multiple tools.

IMPORTANT: You must output ONLY valid JSON. No markdown, no explanations, just the JSON plan.

${availableToolsList}

PLAN STRUCTURE:
{
  "plan": {
    "steps": [
      {
        "id": "step_1",
        "tool": "tool_name",
        "params": { ... },
        "description": "What this step does",
        "dependsOn": ["step_id"],  // Optional: steps that must complete first
        "condition": {              // Optional: only run if condition is met
          "step": "step_id",
          "check": "contains",      // contains, not_contains, equals, not_equals, truthy, falsy
          "value": "sunny"          // Value to check for (for contains/equals)
        }
      }
    ],
    "summary": "Brief description of the overall plan"
  }
}

CONDITION CHECKS:
- "contains": Result text contains the value (case-insensitive)
- "not_contains": Result text does NOT contain the value
- "equals": Result equals the value exactly
- "not_equals": Result does NOT equal the value
- "truthy": Result is successful/truthy
- "falsy": Result is unsuccessful/falsy

EXAMPLES:

1. Simple question:
Input: "What's the weather in Tokyo?"
Output:
{
  "plan": {
    "steps": [
      {
        "id": "step_1",
        "tool": "ai_chat_question",
        "params": { "question": "What's the weather in Tokyo?" },
        "description": "Get Tokyo weather"
      }
    ],
    "summary": "Answer weather question"
  }
}

2. Multiple questions (parallel execution):
Input: "What's the weather in Tokyo? Also recommend restaurants near Tokyo Station"
Output:
{
  "plan": {
    "steps": [
      {
        "id": "step_1",
        "tool": "ai_chat_question",
        "params": { "question": "What's the weather in Tokyo?" },
        "description": "Get Tokyo weather"
      },
      {
        "id": "step_2",
        "tool": "ai_chat_question",
        "params": { "question": "What are some good restaurants near Tokyo Station?" },
        "description": "Get restaurant recommendations"
      }
    ],
    "summary": "Answer weather and restaurant questions"
  }
}

3. Conditional execution:
Input: "If it's sunny in Tokyo tomorrow, email John about having lunch outside"
Output:
{
  "plan": {
    "steps": [
      {
        "id": "step_1",
        "tool": "ai_chat_question",
        "params": { "question": "What will the weather be like in Tokyo tomorrow? Is it going to be sunny?" },
        "description": "Check tomorrow's weather"
      },
      {
        "id": "step_2",
        "tool": "email_send",
        "params": { "recipientName": "John", "subject": "Lunch tomorrow?", "body": "Hi John, the weather looks great tomorrow! Want to have lunch outside?" },
        "description": "Send lunch invitation if sunny",
        "dependsOn": ["step_1"],
        "condition": { "step": "step_1", "check": "contains", "value": "sunny" }
      }
    ],
    "summary": "Check weather and conditionally send lunch invitation"
  }
}

4. Mixed intents (shopping + email):
Input: "Order some shampoo and email mom that I'm visiting next week"
Output:
{
  "plan": {
    "steps": [
      {
        "id": "step_1",
        "tool": "shopping_search_products",
        "params": { "query": "shampoo", "primeOnly": true },
        "description": "Search for shampoo"
      },
      {
        "id": "step_2",
        "tool": "email_send",
        "params": { "recipientName": "mom", "subject": "Visiting next week", "body": "Hi Mom, I wanted to let you know I'll be visiting next week. Looking forward to seeing you!" },
        "description": "Email mom about visit"
      }
    ],
    "summary": "Search for shampoo and send email to mom"
  }
}

5. Sequential with dependency:
Input: "Look up Sarah's email and send her the meeting notes"
Output:
{
  "plan": {
    "steps": [
      {
        "id": "step_1",
        "tool": "email_lookup_contact",
        "params": { "name": "Sarah" },
        "description": "Look up Sarah's email address"
      },
      {
        "id": "step_2",
        "tool": "email_send",
        "params": { "recipientName": "Sarah", "subject": "Meeting Notes", "body": "Hi Sarah, here are the meeting notes as discussed." },
        "description": "Send meeting notes to Sarah",
        "dependsOn": ["step_1"]
      }
    ],
    "summary": "Look up contact and send email"
  }
}

GUIDELINES:
- Always create at least one step
- Use dependsOn when one step needs the result of another
- Use condition when execution depends on a previous result's content
- Steps without dependsOn can run in parallel
- Extract clear parameters from the user's request
- For vague requests, make reasonable assumptions rather than asking for clarification
- Preserve the user's intent and language where appropriate
- For emails: Use the sender's name (provided in [SENDER INFO]) to sign emails appropriately (e.g., "Best, John" not "Best, [Your Name]")
- Write professional, natural email content - never use placeholders like [Your Name] or [Date]
`;

/**
 * JSON Schema for structured output from Gemini planner
 */
export const plannerResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    plan: {
      type: SchemaType.OBJECT,
      properties: {
        steps: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: {
                type: SchemaType.STRING,
                description: 'Unique step identifier'
              },
              tool: {
                type: SchemaType.STRING,
                description: 'Tool name to call'
              },
              params: {
                type: SchemaType.OBJECT,
                description: 'Parameters for the tool'
              },
              description: {
                type: SchemaType.STRING,
                description: 'What this step does'
              },
              dependsOn: {
                type: SchemaType.ARRAY,
                items: { type: SchemaType.STRING },
                description: 'Step IDs that must complete first'
              },
              condition: {
                type: SchemaType.OBJECT,
                properties: {
                  step: { type: SchemaType.STRING },
                  check: { type: SchemaType.STRING },
                  value: { type: SchemaType.STRING },
                  field: { type: SchemaType.STRING }
                },
                description: 'Condition for execution'
              }
            },
            required: ['id', 'tool', 'params', 'description']
          }
        },
        summary: {
          type: SchemaType.STRING,
          description: 'Brief summary of the plan'
        }
      },
      required: ['steps']
    }
  },
  required: ['plan']
};
