import { z } from 'zod';
import { UserInsightsSchema } from './base.js';

/**
 * Shopping Response Schema
 * 
 * For Amazon.co.jp shopping requests with insights extraction.
 */
export const ShoppingResponseSchema = z.object({
  // Shopping intent
  intent: z.enum(['search', 'select', 'order', 'status', 'clarify']).describe(
    "User's shopping intent: search for products, select a product, place order, check order status, or needs clarification"
  ),
  
  // Search query (for search intent)
  searchQuery: z.string().optional().describe("Product search query in Japanese or English"),
  
  // Products (for search results)
  products: z.array(z.object({
    name: z.string(),
    price: z.number().describe("Price in Japanese Yen"),
    description: z.string(),
    productId: z.string().optional(),
    isPrime: z.boolean().optional().describe("Whether product is Prime-eligible"),
    estimatedDelivery: z.string().optional().describe("Estimated delivery timeframe")
  })).optional().describe("Product search results (3-5 products)"),
  
  // Selected product (for select/order intent)
  selectedProduct: z.string().optional().describe("Product ID if user selected a specific product"),
  
  // Delivery address
  deliveryAddress: z.object({
    needsConfirmation: z.boolean().describe("Whether delivery address needs user confirmation"),
    suggestedAddress: z.string().optional().describe("Suggested address from user profile")
  }).optional(),
  
  // Payment method
  paymentMethod: z.object({
    needsSelection: z.boolean().describe("Whether payment method needs to be selected"),
    availableMethods: z.array(z.string()).optional().describe("Available payment methods")
  }).optional(),
  
  // Main response text
  response: z.string().describe("Human-readable response for fax, including product details and next steps"),
  
  // Next action
  nextAction: z.enum(['show_products', 'confirm_order', 'request_payment', 'complete', 'clarify']).optional().describe(
    "Next step in the shopping flow"
  ),
  
  // Metadata
  metadata: z.object({
    totalAmount: z.number().optional().describe("Total order amount in JPY"),
    itemCount: z.number().optional().describe("Number of items in cart/order"),
    orderReference: z.string().optional().describe("Order reference number if order placed")
  }).optional(),
  
  // User insights (strategic data)
  insights: UserInsightsSchema
});

export type ShoppingResponse = z.infer<typeof ShoppingResponseSchema>;

/**
 * Example Shopping responses for few-shot learning
 */
export const ShoppingExamples = [
  {
    input: "I want to buy a rice cooker under ¥5000",
    output: {
      intent: "search",
      searchQuery: "rice cooker under 5000 yen",
      products: [
        {
          name: "Zojirushi Mini Rice Cooker 3-Cup",
          price: 4980,
          description: "Compact rice cooker perfect for 1-2 people. Easy to use, makes perfect rice every time.",
          productId: "B08XYZ123",
          isPrime: true,
          estimatedDelivery: "2-3 days"
        },
        {
          name: "Tiger Basic Rice Cooker 3-Cup",
          price: 3980,
          description: "Simple and reliable rice cooker. Non-stick inner pot, automatic keep-warm function.",
          productId: "B08ABC456",
          isPrime: true,
          estimatedDelivery: "2-3 days"
        },
        {
          name: "Panasonic Compact Rice Cooker",
          price: 4500,
          description: "Energy-efficient rice cooker with timer function. Makes fluffy rice consistently.",
          productId: "B08DEF789",
          isPrime: false,
          estimatedDelivery: "5-7 days"
        }
      ],
      response: "Hello, thank you for contacting Faxi.\n\nI found 3 rice cookers under ¥5,000 for you:\n\n1. Zojirushi Mini Rice Cooker (¥4,980) ★ Prime\n   - Perfect for 1-2 people\n   - Delivery: 2-3 days\n\n2. Tiger Basic Rice Cooker (¥3,980) ★ Prime\n   - Simple and reliable\n   - Delivery: 2-3 days\n\n3. Panasonic Compact Rice Cooker (¥4,500)\n   - Energy-efficient with timer\n   - Delivery: 5-7 days\n\nAll are highly rated and easy to use. The Zojirushi and Tiger models have Prime shipping for faster delivery.\n\nTo order, please send a fax with:\n- Which rice cooker you want (1, 2, or 3)\n- Your delivery address\n\nI'll help you complete the order.",
      nextAction: "show_products",
      metadata: {
        itemCount: 3
      },
      insights: {
        demographics: {
          householdTypeInferred: "single",
          ageRangeInferred: "60-69"
        },
        intentSignals: {
          commercialIntent: [{
            category: "home-appliances",
            product: "rice cooker",
            priceRange: { min: 0, max: 5000 },
            urgency: "near-term"
          }]
        },
        consumerProfile: {
          spendSensitivity: "value",
          categoryPreference: "home-appliances"
        },
        digitalProfile: {
          digitalExclusionScore: 4,
          aiAssistanceNeeded: ["shopping", "product-research"]
        },
        confidenceScores: {
          demographics: 0.75,
          intent: 0.95
        }
      }
    }
  },
  {
    input: "Order the same shampoo I bought last time",
    output: {
      intent: "order",
      searchQuery: "previous order shampoo",
      selectedProduct: "B08PREV001",
      deliveryAddress: {
        needsConfirmation: true,
        suggestedAddress: "123 Sakura Street, Shibuya-ku, Tokyo 150-0001"
      },
      paymentMethod: {
        needsSelection: false
      },
      response: "Hello, thank you for contacting Faxi.\n\nI found your previous order:\n• Kao Essential Shampoo 500ml (¥980)\n\nDelivery address:\n123 Sakura Street\nShibuya-ku, Tokyo 150-0001\n\nPayment: Your registered credit card\n\nTotal: ¥980 (including tax)\nEstimated delivery: 2-3 days with Prime\n\nTo confirm this order, please send a fax with:\n\"Confirm order\"\n\nOr if you need to change the address or product, please let me know.",
      nextAction: "confirm_order",
      metadata: {
        totalAmount: 980,
        itemCount: 1
      },
      insights: {
        demographics: {
          ageRangeInferred: "70-79"
        },
        intentSignals: {
          commercialIntent: [{
            category: "personal-care",
            product: "shampoo",
            urgency: "immediate"
          }]
        },
        behavioral: {
          communicationStyle: "short",
          taskComplexity: "simple"
        },
        consumerProfile: {
          spendSensitivity: "normal",
          brandMentions: ["Kao"],
          categoryPreference: "personal-care"
        },
        digitalProfile: {
          digitalExclusionScore: 5,
          aiAssistanceNeeded: ["shopping", "reordering"]
        },
        confidenceScores: {
          demographics: 0.7,
          intent: 0.95
        }
      }
    }
  },
  {
    input: "Find me a birthday gift for my grandson, he's 8 years old",
    output: {
      intent: "search",
      searchQuery: "birthday gift boy 8 years old",
      products: [
        {
          name: "LEGO City Police Station Building Set",
          price: 6980,
          description: "Popular building set with 743 pieces. Includes police vehicles and minifigures. Great for creative play.",
          productId: "B08LEGO123",
          isPrime: true,
          estimatedDelivery: "2-3 days"
        },
        {
          name: "Nintendo Switch Game: Mario Kart 8",
          price: 5980,
          description: "Best-selling racing game for Nintendo Switch. Fun for the whole family. Age 8+.",
          productId: "B08GAME456",
          isPrime: true,
          estimatedDelivery: "2-3 days"
        },
        {
          name: "Science Experiment Kit for Kids",
          price: 3980,
          description: "Educational science kit with 50+ experiments. Safe and fun learning. Age 8-12.",
          productId: "B08SCI789",
          isPrime: true,
          estimatedDelivery: "2-3 days"
        }
      ],
      response: "Hello, thank you for contacting Faxi.\n\nHere are 3 popular birthday gifts for 8-year-old boys:\n\n1. LEGO City Police Station (¥6,980) ★ Prime\n   - 743-piece building set\n   - Great for creativity\n   - Delivery: 2-3 days\n\n2. Mario Kart 8 for Nintendo Switch (¥5,980) ★ Prime\n   - Best-selling racing game\n   - Fun for whole family\n   - Delivery: 2-3 days\n   - Note: Requires Nintendo Switch console\n\n3. Science Experiment Kit (¥3,980) ★ Prime\n   - 50+ educational experiments\n   - Age 8-12\n   - Delivery: 2-3 days\n\nAll items are highly rated and age-appropriate. The LEGO set is most popular for this age.\n\nTo order, please send a fax with:\n- Which gift you want (1, 2, or 3)\n- Your delivery address\n- Gift wrapping? (Yes/No)\n\nI'll help you complete the order.",
      nextAction: "show_products",
      metadata: {
        itemCount: 3
      },
      insights: {
        demographics: {
          ageRangeInferred: "60-69",
          householdTypeInferred: "couple"
        },
        lifeEvents: {
          newCaregiverDetected: false
        },
        intentSignals: {
          commercialIntent: [{
            category: "toys",
            product: "birthday gift",
            priceRange: { min: 3000, max: 7000 },
            urgency: "near-term"
          }]
        },
        behavioral: {
          communicationStyle: "detailed",
          taskComplexity: "moderate"
        },
        consumerProfile: {
          spendSensitivity: "normal",
          categoryPreference: "toys"
        },
        digitalProfile: {
          digitalExclusionScore: 4,
          aiAssistanceNeeded: ["shopping", "product-research", "gift-selection"]
        },
        confidenceScores: {
          demographics: 0.8,
          intent: 0.9
        }
      }
    }
  }
];
