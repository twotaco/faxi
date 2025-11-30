import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { intentExtractor } from '../../services/intentExtractor';
import { mcpControllerAgent } from '../../services/mcpControllerAgent';
import { conversationContextRepository } from '../../repositories/conversationContextRepository';
import { userRepository } from '../../repositories/userRepository';
import { db } from '../../database/connection';

/**
 * Integration test for shopping flow
 * Tests: product search → selection → order creation
 * 
 * Requirements: 1.1, 1.2, 2.1, 5.3
 */
describe('Shopping Flow Integration', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create test user
    const user = await userRepository.create({
      phoneNumber: '+81-90-1234-5678',
      name: 'Test User',
      emailAddress: 'test@example.com',
      isActive: true
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    await db.query('DELETE FROM conversation_contexts WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  describe('Intent Detection', () => {
    it('should detect product_search intent', async () => {
      const result = await intentExtractor.extractIntent(
        'I need to buy shampoo',
        []
      );

      expect(result.intent).toBe('shopping');
      expect(result.parameters.shoppingSubIntent).toBe('product_search');
      expect(result.parameters.productQuery).toBe('shampoo');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect product_search with price range', async () => {
      const result = await intentExtractor.extractIntent(
        'Find me a rice cooker under ¥5000',
        []
      );

      expect(result.intent).toBe('shopping');
      expect(result.parameters.shoppingSubIntent).toBe('product_search');
      expect(result.parameters.productQuery).toBe('rice cooker');
      expect(result.parameters.priceRange).toEqual({ max: 5000 });
    });

    it('should detect product_selection intent from visual annotations', async () => {
      const result = await intentExtractor.extractIntent(
        'I want option B',
        [
          {
            type: 'circle',
            boundingBox: { x: 100, y: 100, width: 50, height: 50 },
            associatedText: 'B',
            confidence: 0.9
          }
        ]
      );

      expect(result.intent).toBe('shopping');
      expect(result.parameters.shoppingSubIntent).toBe('product_selection');
      expect(result.parameters.selectedProductIds).toEqual(['B']);
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect order_status intent', async () => {
      const result = await intentExtractor.extractIntent(
        'What is the status of my order? Reference: FX-2025-123456',
        []
      );

      expect(result.intent).toBe('shopping');
      expect(result.parameters.shoppingSubIntent).toBe('order_status');
      expect(result.parameters.referenceId).toBe('FX-2025-123456');
    });
  });

  describe('MCP Controller Agent - Shopping Workflow', () => {
    it('should verify shopping MCP server is registered', () => {
      const verification = mcpControllerAgent.verifyServerRegistration();
      
      expect(verification.success).toBe(true);
      expect(verification.registeredServers).toContain('shopping');
    });

    it('should get shopping tools', () => {
      const tools = mcpControllerAgent.getServerTools('shopping');
      
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.map(t => t.name)).toContain('search_products');
      expect(tools.map(t => t.name)).toContain('create_order');
      expect(tools.map(t => t.name)).toContain('get_order_status');
    });

    it('should execute search_products tool', async () => {
      const result = await mcpControllerAgent.executeTool(
        'shopping',
        'search_products',
        {
          userId: testUserId,
          query: 'test product',
          filters: {
            primeOnly: true,
            minRating: 3.5
          }
        }
      );

      expect(result.success).toBe(true);
      expect(result.products).toBeDefined();
      expect(result.referenceId).toBeDefined();
      expect(result.referenceId).toMatch(/^FX-\d{4}-\d{6}$/);
    });

    it('should save shopping context after product search', async () => {
      // Execute search
      const searchResult = await mcpControllerAgent.executeTool(
        'shopping',
        'search_products',
        {
          userId: testUserId,
          query: 'shampoo',
          filters: {
            primeOnly: true,
            minRating: 3.5
          }
        }
      );

      expect(searchResult.success).toBe(true);
      const referenceId = searchResult.referenceId;

      // Verify context was saved
      const context = await conversationContextRepository.findByReferenceId(referenceId);
      
      expect(context).not.toBeNull();
      expect(context?.contextType).toBe('shopping');
      expect(context?.userId).toBe(testUserId);
      expect(context?.contextData.searchQuery).toBe('shampoo');
      expect(context?.contextData.searchResults).toBeDefined();
      expect(context?.contextData.searchResults.length).toBeGreaterThan(0);
      expect(context?.contextData.searchResults.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Conversation Context Management', () => {
    it('should retrieve shopping context for product selection', async () => {
      // First, create a shopping context
      const referenceId = `FX-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await conversationContextRepository.create({
        userId: testUserId,
        referenceId,
        contextType: 'shopping',
        contextData: {
          searchQuery: 'test product',
          searchResults: [
            {
              asin: 'B08TEST001',
              title: 'Test Product A',
              price: 1000,
              selectionMarker: 'A'
            },
            {
              asin: 'B08TEST002',
              title: 'Test Product B',
              price: 2000,
              selectionMarker: 'B'
            }
          ]
        },
        expiresAt
      });

      // Retrieve context
      const context = await conversationContextRepository.findByReferenceId(referenceId);
      
      expect(context).not.toBeNull();
      expect(context?.contextData.searchResults).toHaveLength(2);
      expect(context?.contextData.searchResults[0].selectionMarker).toBe('A');
      expect(context?.contextData.searchResults[1].selectionMarker).toBe('B');
    });

    it('should find recent shopping contexts for user', async () => {
      const contexts = await conversationContextRepository.findRecentByUser(testUserId, 7);
      const shoppingContexts = contexts.filter(c => c.contextType === 'shopping');
      
      expect(shoppingContexts.length).toBeGreaterThan(0);
    });

    it('should expire old contexts', async () => {
      // Create an expired context
      const referenceId = `FX-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1); // Already expired

      await conversationContextRepository.create({
        userId: testUserId,
        referenceId,
        contextType: 'shopping',
        contextData: { test: 'data' },
        expiresAt
      });

      // Find active contexts (should not include expired)
      const activeContexts = await conversationContextRepository.findActiveByUser(testUserId);
      const expiredContext = activeContexts.find(c => c.referenceId === referenceId);
      
      expect(expiredContext).toBeUndefined();
    });
  });

  describe('Parameter Completeness Assessment', () => {
    it('should assess product_search parameters', () => {
      const score = intentExtractor.assessParameterCompleteness('shopping', {
        shoppingSubIntent: 'product_search',
        productQuery: 'shampoo',
        priceRange: { max: 5000 }
      });

      expect(score).toBeGreaterThan(0.6);
    });

    it('should assess product_selection parameters', () => {
      const score = intentExtractor.assessParameterCompleteness('shopping', {
        shoppingSubIntent: 'product_selection',
        selectedProductIds: ['B']
      });

      expect(score).toBe(1.0);
    });

    it('should assess order_status parameters with reference ID', () => {
      const score = intentExtractor.assessParameterCompleteness('shopping', {
        shoppingSubIntent: 'order_status',
        referenceId: 'FX-2025-123456'
      });

      expect(score).toBe(1.0);
    });

    it('should assess order_status parameters without reference ID', () => {
      const score = intentExtractor.assessParameterCompleteness('shopping', {
        shoppingSubIntent: 'order_status'
      });

      expect(score).toBe(0.5);
    });
  });
});
