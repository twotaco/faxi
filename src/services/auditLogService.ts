import { auditLogRepository, CreateAuditLogData } from '../repositories/auditLogRepository';

/**
 * Audit Log Service
 * Provides convenient methods for logging system operations
 */
export class AuditLogService {
  /**
   * Log fax receipt
   */
  async logFaxReceipt(data: {
    userId?: string;
    faxJobId: string;
    fromNumber: string;
    toNumber: string;
    pageCount?: number;
    faxId: string;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      faxJobId: data.faxJobId,
      eventType: 'fax.received',
      eventData: {
        fromNumber: data.fromNumber,
        toNumber: data.toNumber,
        pageCount: data.pageCount,
        faxId: data.faxId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log fax transmission
   */
  async logFaxTransmission(data: {
    userId: string;
    faxJobId: string;
    fromNumber: string;
    toNumber: string;
    referenceId?: string;
    status: 'sent' | 'failed';
    errorMessage?: string;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      faxJobId: data.faxJobId,
      eventType: 'fax.transmitted',
      eventData: {
        fromNumber: data.fromNumber,
        toNumber: data.toNumber,
        referenceId: data.referenceId,
        status: data.status,
        errorMessage: data.errorMessage,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log AI interpretation
   */
  async logAIInterpretation(data: {
    userId: string;
    faxJobId: string;
    intent: string;
    confidence: number;
    parameters: any;
    requiresClarification: boolean;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      faxJobId: data.faxJobId,
      eventType: 'ai.interpretation',
      eventData: {
        intent: data.intent,
        confidence: data.confidence,
        parameters: data.parameters,
        requiresClarification: data.requiresClarification,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log MCP tool call
   */
  async logMCPToolCall(data: {
    userId: string;
    faxJobId: string;
    toolName: string;
    toolServer: string;
    input: any;
    output: any;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      faxJobId: data.faxJobId,
      eventType: 'mcp.tool_call',
      eventData: {
        toolName: data.toolName,
        toolServer: data.toolServer,
        input: data.input,
        output: data.output,
        success: data.success,
        errorMessage: data.errorMessage,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log external API call
   */
  async logAPICall(data: {
    userId?: string;
    faxJobId?: string;
    service: string;
    endpoint: string;
    method: string;
    statusCode?: number;
    success: boolean;
    errorMessage?: string;
    duration?: number;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      faxJobId: data.faxJobId,
      eventType: 'api.call',
      eventData: {
        service: data.service,
        endpoint: data.endpoint,
        method: data.method,
        statusCode: data.statusCode,
        success: data.success,
        errorMessage: data.errorMessage,
        duration: data.duration,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log email sent
   */
  async logEmailSent(data: {
    userId: string;
    faxJobId: string;
    from: string;
    to: string;
    subject: string;
    messageId?: string;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      faxJobId: data.faxJobId,
      eventType: 'email.sent',
      eventData: {
        from: data.from,
        to: data.to,
        subject: data.subject,
        messageId: data.messageId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log email received
   */
  async logEmailReceived(data: {
    userId: string;
    from: string;
    to: string;
    subject: string;
    messageId?: string;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      eventType: 'email.received',
      eventData: {
        from: data.from,
        to: data.to,
        subject: data.subject,
        messageId: data.messageId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log order created
   */
  async logOrderCreated(data: {
    userId: string;
    faxJobId: string;
    orderId: string;
    externalOrderId?: string;
    totalAmount: number;
    currency: string;
    items: any;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      faxJobId: data.faxJobId,
      eventType: 'order.created',
      eventData: {
        orderId: data.orderId,
        externalOrderId: data.externalOrderId,
        totalAmount: data.totalAmount,
        currency: data.currency,
        items: data.items,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log payment processed
   */
  async logPaymentProcessed(data: {
    userId: string;
    faxJobId?: string;
    paymentMethodId: string;
    amount: number;
    currency: string;
    transactionId?: string;
    success: boolean;
    errorMessage?: string;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      faxJobId: data.faxJobId,
      eventType: 'payment.processed',
      eventData: {
        paymentMethodId: data.paymentMethodId,
        amount: data.amount,
        currency: data.currency,
        transactionId: data.transactionId,
        success: data.success,
        errorMessage: data.errorMessage,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log user registration
   */
  async logUserRegistration(data: {
    userId: string;
    phoneNumber: string;
    emailAddress: string;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      eventType: 'user.registered',
      eventData: {
        phoneNumber: data.phoneNumber,
        emailAddress: data.emailAddress,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log system error
   */
  async logSystemError(data: {
    userId?: string;
    faxJobId?: string;
    errorType: string;
    errorMessage: string;
    stackTrace?: string;
    context?: any;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      faxJobId: data.faxJobId,
      eventType: 'system.error',
      eventData: {
        errorType: data.errorType,
        errorMessage: data.errorMessage,
        stackTrace: data.stackTrace,
        context: data.context,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Query logs by entity (user or fax job) and time range
   */
  async queryLogs(params: {
    userId?: string;
    faxJobId?: string;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    if (params.faxJobId) {
      return await auditLogRepository.findByFaxJobId(params.faxJobId, params.limit);
    }

    if (params.userId) {
      return await auditLogRepository.findByUserId(params.userId, params.limit);
    }

    if (params.eventType) {
      return await auditLogRepository.findByEventType(params.eventType, params.limit);
    }

    throw new Error('Must provide userId, faxJobId, or eventType for log query');
  }

  /**
   * Generic log method for custom events
   */
  async log(data: CreateAuditLogData): Promise<void> {
    await auditLogRepository.create(data);
  }

  /**
   * Generic log operation method for system operations
   */
  async logOperation(data: {
    entityType: string;
    entityId: string;
    operation: string;
    details?: any;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.entityId !== 'system' ? data.entityId : undefined,
      eventType: `${data.entityType}.${data.operation}`,
      eventData: {
        ...data.details,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

export const auditLogService = new AuditLogService();
