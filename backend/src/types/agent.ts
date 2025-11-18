// Types for MCP Controller Agent

import { InterpretationResult } from './vision.js';
import { FaxTemplate } from './fax.js';

export interface AgentRequest {
  interpretation: InterpretationResult;
  userId: string;
  faxJobId: string;
  conversationContext?: any;
  recentFaxes?: FaxHistory[];
}

export interface FaxHistory {
  id: string;
  referenceId: string;
  direction: 'inbound' | 'outbound';
  intent?: string;
  status: string;
  createdAt: Date;
}

export interface AgentResponse {
  success: boolean;
  steps: AgentStep[];
  finalResult: any;
  responseType: 'completion' | 'selection_required' | 'payment_required' | 'clarification';
  faxTemplate: FaxTemplate;
  autoExecuteOnReply?: boolean;
  userMessage: string;
}

export interface AgentStep {
  toolName: string;
  toolServer: string;
  input: any;
  output: any;
  timestamp: Date;
  success: boolean;
  error?: string;
}

// FaxTemplate and FaxPage are imported from './fax.js'

// MCP Tool interfaces
export interface MCPServer {
  name: string;
  description: string;
  tools: MCPTool[];
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any; // JSON Schema
  handler: (params: any) => Promise<any>;
}

export interface MCPToolCall {
  server: string;
  tool: string;
  input: any;
  output?: any;
  error?: string;
  timestamp: Date;
}

// Decision framework types
export interface DecisionContext {
  interpretation: InterpretationResult;
  userId: string;
  userProfile?: UserProfile;
  paymentMethods?: PaymentMethod[];
  recentOrders?: Order[];
  addressBook?: Contact[];
}

export interface UserProfile {
  id: string;
  phoneNumber: string;
  emailAddress: string;
  deliveryAddress?: string;
  preferences: Record<string, any>;
}

export interface PaymentMethod {
  id: string;
  type: 'credit_card' | 'convenience_store';
  isDefault: boolean;
  details: Record<string, any>;
}

export interface Order {
  id: string;
  status: string;
  items: OrderItem[];
  total: number;
  createdAt: Date;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  relationship?: string;
}

// Workflow orchestration types
export interface WorkflowStep {
  id: string;
  type: 'tool_call' | 'decision' | 'user_input';
  description: string;
  dependencies?: string[];
  toolCall?: {
    server: string;
    tool: string;
    input: any;
  };
  condition?: (context: any) => boolean;
}

export interface WorkflowResult {
  success: boolean;
  steps: AgentStep[];
  finalOutput: any;
  requiresUserInput: boolean;
  nextAction?: string;
}