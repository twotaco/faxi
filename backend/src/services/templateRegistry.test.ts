/**
 * Property-Based Tests for Template Registry
 * 
 * Tests universal properties that should hold across all inputs
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { TemplateRegistry } from './templateRegistry';

describe('TemplateRegistry', () => {
  let registry: TemplateRegistry;
  
  beforeEach(() => {
    registry = TemplateRegistry.getInstance();
    registry.resetToDefaults();
  });
  
  describe('Unit Tests', () => {
    it('should return product_selection template for shopping MCP', () => {
      const template = registry.getTemplate('shopping', 'search_products');
      expect(template).toBe('product_selection');
    });
    
    it('should return email_reply template for email MCP', () => {
      const template = registry.getTemplate('email', 'send_email');
      expect(template).toBe('email_reply');
    });
    
    it('should return general_inquiry template for ai_chat MCP', () => {
      const template = registry.getTemplate('ai_chat');
      expect(template).toBe('general_inquiry');
    });
    
    it('should return appointment_selection template for appointment MCP', () => {
      const template = registry.getTemplate('appointment', 'search_appointments');
      expect(template).toBe('appointment_selection');
    });
    
    it('should return payment_barcodes template for payment MCP', () => {
      const template = registry.getTemplate('payment', 'generate_barcode');
      expect(template).toBe('payment_barcodes');
    });
    
    it('should return fallback template for unknown MCP server', () => {
      const template = registry.getTemplate('unknown_server');
      expect(template).toBe('general_inquiry');
    });
    
    it('should prefer exact match over server-only match', () => {
      registry.register('test_server', 'specific_intent', 'email_reply', 10);
      registry.register('test_server', undefined, 'product_selection', 5);
      
      const template = registry.getTemplate('test_server', 'specific_intent');
      expect(template).toBe('email_reply');
    });
    
    it('should fall back to server-only match when intent not found', () => {
      registry.register('test_server', undefined, 'product_selection', 5);
      
      const template = registry.getTemplate('test_server', 'unknown_intent');
      expect(template).toBe('product_selection');
    });
  });
  
  describe('Property-Based Tests', () => {
    // Feature: fax-template-system, Property 1: Template selection correctness
    it('should always return valid template for any MCP server/intent', () => {
      const validTemplateTypes = [
        'email_reply',
        'product_selection',
        'payment_barcodes',
        'confirmation',
        'clarification',
        'welcome',
        'appointment_selection',
        'general_inquiry',
        'multi_action'
      ];
      
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }), // mcpServer
          fc.option(fc.string({ minLength: 1, maxLength: 50 })), // intent
          (mcpServer, intent) => {
            const template = registry.getTemplate(mcpServer, intent ?? undefined);
            expect(validTemplateTypes).toContain(template);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    // Feature: fax-template-system, Property 1: Template selection correctness (determinism)
    it('should return same template for same inputs (determinism)', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }), // mcpServer
          fc.option(fc.string({ minLength: 1, maxLength: 50 })), // intent
          (mcpServer, intent) => {
            const template1 = registry.getTemplate(mcpServer, intent ?? undefined);
            const template2 = registry.getTemplate(mcpServer, intent ?? undefined);
            expect(template1).toBe(template2);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    // Feature: fax-template-system, Property 1: Template selection correctness (fallback)
    it('should always return fallback template when no mapping exists', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => {
            // Filter out known MCP servers
            const knownServers = ['shopping', 'email', 'ai_chat', 'chat', 'appointment', 'payment'];
            return !knownServers.includes(s);
          }),
          (unknownServer) => {
            const template = registry.getTemplate(unknownServer);
            expect(template).toBe('general_inquiry');
          }
        ),
        { numRuns: 100 }
      );
    });
    
    // Feature: fax-template-system, Property 1: Template selection correctness (registration)
    it('should return registered template after registration', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }), // mcpServer
          fc.option(fc.string({ minLength: 1, maxLength: 50 })), // intent
          fc.constantFrom(
            'email_reply',
            'product_selection',
            'payment_barcodes',
            'confirmation',
            'clarification',
            'welcome',
            'appointment_selection',
            'general_inquiry',
            'multi_action'
          ), // templateType
          (mcpServer, intent, templateType) => {
            // Register the mapping
            registry.register(mcpServer, intent ?? undefined, templateType as any);
            
            // Verify it returns the registered template
            const result = registry.getTemplate(mcpServer, intent ?? undefined);
            expect(result).toBe(templateType);
            
            // Clean up
            registry.resetToDefaults();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
