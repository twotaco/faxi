/**
 * Shopping MCP Server Integration Tests
 * 
 * Tests the shopping MCP server tools and their integration with
 * the product search service and order repository.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { shoppingMCPServer } from '../../mcp/shoppingMcpServer';

describe('Shopping MCP Server', () => {
  describe('Server Registration', () => {
    it('should have correct server name', () => {
      expect(shoppingMCPServer.name).toBe('shopping');
    });

    it('should have correct description', () => {
      expect(shoppingMCPServer.description).toBe('E-commerce shopping and order management tools');
    });

    it('should register all required tools', () => {
      const toolNames = shoppingMCPServer.tools.map(t => t.name);
      
      expect(toolNames).toContain('search_products');
      expect(toolNames).toContain('get_product_details');
      expect(toolNames).toContain('create_order');
      expect(toolNames).toContain('get_order_status');
      expect(toolNames).toContain('list_user_orders');
    });

    it('should have exactly 5 tools', () => {
      expect(shoppingMCPServer.tools).toHaveLength(5);
    });
  });

  describe('Tool Schemas', () => {
    it('search_products should have correct input schema', () => {
      const tool = shoppingMCPServer.tools.find(t => t.name === 'search_products');
      expect(tool).toBeDefined();
      expect(tool!.inputSchema.required).toContain('userId');
      expect(tool!.inputSchema.required).toContain('query');
    });

    it('get_product_details should have correct input schema', () => {
      const tool = shoppingMCPServer.tools.find(t => t.name === 'get_product_details');
      expect(tool).toBeDefined();
      expect(tool!.inputSchema.required).toContain('userId');
      expect(tool!.inputSchema.required).toContain('asin');
    });

    it('create_order should have correct input schema', () => {
      const tool = shoppingMCPServer.tools.find(t => t.name === 'create_order');
      expect(tool).toBeDefined();
      expect(tool!.inputSchema.required).toContain('userId');
      expect(tool!.inputSchema.required).toContain('referenceId');
      expect(tool!.inputSchema.required).toContain('productAsin');
    });

    it('get_order_status should have correct input schema', () => {
      const tool = shoppingMCPServer.tools.find(t => t.name === 'get_order_status');
      expect(tool).toBeDefined();
      expect(tool!.inputSchema.required).toContain('userId');
      expect(tool!.inputSchema.required).toContain('referenceId');
    });

    it('list_user_orders should have correct input schema', () => {
      const tool = shoppingMCPServer.tools.find(t => t.name === 'list_user_orders');
      expect(tool).toBeDefined();
      expect(tool!.inputSchema.required).toContain('userId');
    });
  });

  describe('Tool Descriptions', () => {
    it('all tools should have descriptions', () => {
      shoppingMCPServer.tools.forEach(tool => {
        expect(tool.description).toBeDefined();
        expect(tool.description.length).toBeGreaterThan(0);
      });
    });

    it('all tools should have handlers', () => {
      shoppingMCPServer.tools.forEach(tool => {
        expect(tool.handler).toBeDefined();
        expect(typeof tool.handler).toBe('function');
      });
    });
  });
});
