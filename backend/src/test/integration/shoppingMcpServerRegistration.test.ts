/**
 * Shopping MCP Server Registration Test
 * 
 * Verifies that the shopping MCP server is properly registered
 * with the MCP Controller Agent.
 */

import { describe, it, expect } from 'vitest';
import { MCPControllerAgent } from '../../services/mcpControllerAgent';

describe('Shopping MCP Server Registration', () => {
  const agent = new MCPControllerAgent();

  it('should register shopping MCP server', () => {
    const verification = agent.verifyServerRegistration();
    
    expect(verification.success).toBe(true);
    expect(verification.registeredServers).toContain('shopping');
    expect(verification.missingServers).toHaveLength(0);
  });

  it('should have shopping tools available', () => {
    const shoppingTools = agent.getServerTools('shopping');
    
    expect(shoppingTools).toBeDefined();
    expect(shoppingTools.length).toBeGreaterThan(0);
    
    const toolNames = shoppingTools.map(t => t.name);
    expect(toolNames).toContain('search_products');
    expect(toolNames).toContain('get_product_details');
    expect(toolNames).toContain('create_order');
    expect(toolNames).toContain('get_order_status');
    expect(toolNames).toContain('list_user_orders');
  });

  it('should list shopping server in all servers', () => {
    const allServers = agent.getAllServersAndTools();
    
    const shoppingServer = allServers.find(s => s.serverName === 'shopping');
    expect(shoppingServer).toBeDefined();
    expect(shoppingServer!.tools).toContain('search_products');
    expect(shoppingServer!.tools).toContain('get_product_details');
    expect(shoppingServer!.tools).toContain('create_order');
    expect(shoppingServer!.tools).toContain('get_order_status');
    expect(shoppingServer!.tools).toContain('list_user_orders');
  });

  it('should be able to execute shopping tools', async () => {
    // Test that the tool execution mechanism works (without actually calling PA-API)
    const tool = agent.getServerTools('shopping').find(t => t.name === 'search_products');
    expect(tool).toBeDefined();
    expect(tool!.handler).toBeDefined();
    expect(typeof tool!.handler).toBe('function');
  });
});
