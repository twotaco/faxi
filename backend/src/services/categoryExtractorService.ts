/**
 * Category Extractor Service
 *
 * Uses Gemini 2.5 Flash Lite to extract product category and requirements from user queries.
 * This enables category-based cache lookups instead of exact query matching.
 *
 * Examples:
 * - "shampoo 500ml" → { category: "shampoo", requirements: { quantity: "500ml" } }
 * - "花王の石鹸" → { category: "soap", requirements: { brand: "花王" } }
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import { loggingService } from './loggingService';

export interface CategoryRequirements {
  quantity?: string;     // "500ml", "2pack", "large"
  brand?: string;        // "花王", "P&G"
  special?: string[];    // ["medicated", "for dry hair", "organic"]
}

export interface CategoryExtraction {
  category: string;              // Normalized category: "shampoo", "soap", "toothpaste"
  categoryJa?: string;           // Japanese category name for display
  requirements: CategoryRequirements;
  confidence: number;            // 0-1 confidence score
}

const EXTRACTION_PROMPT = `You are a product category classifier for an e-commerce system.

Extract the product category and any specific requirements from this shopping query.

Query: "{query}"

Return JSON with:
- category: The base product type in English, lowercase (shampoo, soap, toothpaste, detergent, tissue, etc.)
- categoryJa: The Japanese name for the category
- requirements: Object with optional fields:
  - quantity: Size/amount if specified (e.g., "500ml", "2個セット", "大")
  - brand: Brand name if specified (e.g., "花王", "P&G", "ライオン")
  - special: Array of special requirements (e.g., ["薬用", "敏感肌用", "無添加"])
- confidence: How confident you are (0.0-1.0)

Examples:
- "500mlのシャンプー" → {"category":"shampoo","categoryJa":"シャンプー","requirements":{"quantity":"500ml"},"confidence":0.95}
- "花王の石鹸" → {"category":"soap","categoryJa":"石鹸","requirements":{"brand":"花王"},"confidence":0.9}
- "薬用シャンプー" → {"category":"shampoo","categoryJa":"シャンプー","requirements":{"special":["薬用"]},"confidence":0.9}

Return ONLY valid JSON, no markdown or explanation:`;

class CategoryExtractorService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    // Use gemini-2.5-flash-lite for fast extraction
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });
  }

  /**
   * Extract category and requirements from a user query
   */
  async extractCategory(query: string): Promise<CategoryExtraction> {
    const startTime = Date.now();

    try {
      const prompt = EXTRACTION_PROMPT.replace('{query}', query);

      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();

      const extracted = JSON.parse(responseText);

      const extraction: CategoryExtraction = {
        category: extracted.category?.toLowerCase() || 'unknown',
        categoryJa: extracted.categoryJa,
        requirements: {
          quantity: extracted.requirements?.quantity,
          brand: extracted.requirements?.brand,
          special: extracted.requirements?.special
        },
        confidence: extracted.confidence || 0.5
      };

      const duration = Date.now() - startTime;
      loggingService.debug('Category extracted', {
        query,
        category: extraction.category,
        requirements: extraction.requirements,
        confidence: extraction.confidence,
        durationMs: duration
      });

      return extraction;

    } catch (error) {
      loggingService.warn('Category extraction failed, using fallback', {
        query,
        error: String(error)
      });

      // Fallback: use the query itself as category
      return {
        category: this.fallbackCategoryExtraction(query),
        requirements: {},
        confidence: 0.3
      };
    }
  }

  /**
   * Simple keyword-based fallback when LLM fails
   */
  private fallbackCategoryExtraction(query: string): string {
    const lowerQuery = query.toLowerCase();

    const categoryKeywords: Record<string, string[]> = {
      'shampoo': ['shampoo', 'シャンプー'],
      'conditioner': ['conditioner', 'コンディショナー', 'リンス'],
      'soap': ['soap', '石鹸', 'せっけん', 'ボディソープ'],
      'toothpaste': ['toothpaste', '歯磨き', 'はみがき'],
      'detergent': ['detergent', '洗剤', 'せんざい'],
      'tissue': ['tissue', 'ティッシュ', 'トイレットペーパー'],
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => lowerQuery.includes(kw))) {
        return category;
      }
    }

    return 'unknown';
  }
}

export const categoryExtractorService = new CategoryExtractorService();
