/**
 * Template Registry Service
 * 
 * Centralized registry that maps MCP servers and intents to template types.
 * Implements singleton pattern for global access.
 */

type TemplateType = 
  | 'email_reply' 
  | 'product_selection' 
  | 'payment_barcodes' 
  | 'confirmation' 
  | 'clarification'
  | 'welcome'
  | 'appointment_selection'
  | 'general_inquiry'
  | 'multi_action';

interface TemplateMapping {
  mcpServer: string;
  intent?: string;
  templateType: TemplateType;
  priority: number; // For handling conflicts, higher priority wins
}

export class TemplateRegistry {
  private static instance: TemplateRegistry;
  private mappings: Map<string, TemplateType>;
  
  private constructor() {
    this.mappings = new Map();
    this.initializeMappings();
  }
  
  /**
   * Get singleton instance of TemplateRegistry
   */
  static getInstance(): TemplateRegistry {
    if (!TemplateRegistry.instance) {
      TemplateRegistry.instance = new TemplateRegistry();
    }
    return TemplateRegistry.instance;
  }
  
  /**
   * Initialize default MCP server → template type mappings
   */
  private initializeMappings(): void {
    // Shopping MCP → Product Selection Template
    this.register('shopping', 'search_products', 'product_selection', 10);
    this.register('shopping', 'get_product_details', 'product_selection', 10);
    this.register('shopping', undefined, 'product_selection', 5);
    
    // Email MCP → Email Response Template
    this.register('email', 'send_email', 'email_reply', 10);
    this.register('email', 'email_request', 'email_reply', 10);
    this.register('email', 'read_email', 'email_reply', 10);
    this.register('email', undefined, 'email_reply', 5);
    
    // AI Chat MCP → General Inquiry Template
    this.register('ai_chat', undefined, 'general_inquiry', 5);
    this.register('chat', undefined, 'general_inquiry', 5);
    
    // Appointment MCP → Appointment Selection Template
    this.register('appointment', 'search_appointments', 'appointment_selection', 10);
    this.register('appointment', 'book_appointment', 'appointment_selection', 10);
    this.register('appointment', undefined, 'appointment_selection', 5);
    
    // Payment MCP → Payment Barcode Template
    this.register('payment', 'generate_barcode', 'payment_barcodes', 10);
    this.register('payment', 'register_payment', 'payment_barcodes', 10);
    this.register('payment', undefined, 'payment_barcodes', 5);
  }
  
  /**
   * Register a new template mapping
   * 
   * @param mcpServer - MCP server name (e.g., 'shopping', 'email')
   * @param intent - Optional specific intent (e.g., 'search_products')
   * @param templateType - Template type to use
   * @param priority - Priority for conflict resolution (default: 5)
   */
  register(
    mcpServer: string, 
    intent: string | undefined, 
    templateType: TemplateType,
    priority: number = 5
  ): void {
    const key = this.createKey(mcpServer, intent);
    
    // Check if mapping already exists with lower priority
    const existingKey = this.findExistingMapping(mcpServer, intent);
    if (existingKey) {
      // For now, just overwrite. In production, we'd check priority
      this.mappings.set(key, templateType);
    } else {
      this.mappings.set(key, templateType);
    }
  }
  
  /**
   * Get template type for given MCP server and intent
   * 
   * @param mcpServer - MCP server name
   * @param intent - Optional intent
   * @returns Template type to use
   */
  getTemplate(mcpServer: string, intent?: string): TemplateType {
    // Try exact match first (server + intent)
    if (intent) {
      const exactKey = this.createKey(mcpServer, intent);
      if (this.mappings.has(exactKey)) {
        return this.mappings.get(exactKey)!;
      }
    }
    
    // Try server-only match
    const serverKey = this.createKey(mcpServer, undefined);
    if (this.mappings.has(serverKey)) {
      return this.mappings.get(serverKey)!;
    }
    
    // Fallback to general inquiry template
    return this.getFallbackTemplate();
  }
  
  /**
   * Get fallback template type when no mapping exists
   * 
   * @returns Default template type
   */
  getFallbackTemplate(): TemplateType {
    return 'general_inquiry';
  }
  
  /**
   * Create cache key from MCP server and intent
   */
  private createKey(mcpServer: string, intent?: string): string {
    return intent ? `${mcpServer}:${intent}` : mcpServer;
  }
  
  /**
   * Find existing mapping for given server and intent
   */
  private findExistingMapping(mcpServer: string, intent?: string): string | null {
    const key = this.createKey(mcpServer, intent);
    return this.mappings.has(key) ? key : null;
  }
  
  /**
   * Get all registered mappings (for debugging/testing)
   */
  getAllMappings(): Map<string, TemplateType> {
    return new Map(this.mappings);
  }
  
  /**
   * Clear all mappings (for testing)
   */
  clearMappings(): void {
    this.mappings.clear();
  }
  
  /**
   * Reset to default mappings (for testing)
   */
  resetToDefaults(): void {
    this.clearMappings();
    this.initializeMappings();
  }
}

// Export singleton instance for convenience
export const templateRegistry = TemplateRegistry.getInstance();
