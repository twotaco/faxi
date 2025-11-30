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
    userId?: string;
    faxJobId?: string;
    fromNumber: string;
    toNumber: string;
    mediaUrl?: string;
    referenceId?: string;
    status: 'attempting' | 'queued' | 'sent' | 'failed' | 'retry' | 'failed_final' | 'mock_sent';
    attempt?: number;
    telnyxFaxId?: string;
    errorMessage?: string;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      faxJobId: data.faxJobId,
      eventType: 'fax.transmitted',
      eventData: {
        fromNumber: data.fromNumber,
        toNumber: data.toNumber,
        mediaUrl: data.mediaUrl,
        referenceId: data.referenceId,
        status: data.status,
        attempt: data.attempt,
        telnyxFaxId: data.telnyxFaxId,
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
    faxJobId: string | null;
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
    fromEmail: string;
    toEmail: string;
    subject: string;
    bodyLength: number;
    hasAttachments: boolean;
    provider: string;
    messageId?: string;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      eventType: 'email.received',
      eventData: {
        fromEmail: data.fromEmail,
        toEmail: data.toEmail,
        subject: data.subject,
        bodyLength: data.bodyLength,
        hasAttachments: data.hasAttachments,
        provider: data.provider,
        messageId: data.messageId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log email event (bounced, complained, delivered)
   */
  async logEmailEvent(data: {
    userId: string;
    eventType: 'email.bounced' | 'email.complained' | 'email.delivered';
    messageId: string;
    details: any;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      eventType: data.eventType,
      eventData: {
        messageId: data.messageId,
        ...data.details,
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
   * Log shopping action (add to cart, remove from cart, etc.)
   */
  async logShoppingAction(data: {
    userId: string;
    faxJobId?: string;
    action: 'add_to_cart' | 'remove_from_cart' | 'update_cart_item' | 'clear_cart';
    productId?: string;
    quantity?: number;
    cartTotal?: number;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      faxJobId: data.faxJobId,
      eventType: `shopping.${data.action}`,
      eventData: {
        productId: data.productId,
        quantity: data.quantity,
        cartTotal: data.cartTotal,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log order placed
   */
  async logOrderPlaced(data: {
    userId: string;
    faxJobId?: string;
    orderId: string;
    externalOrderId?: string;
    totalAmount: number;
    itemCount: number;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      faxJobId: data.faxJobId,
      eventType: 'order.placed',
      eventData: {
        orderId: data.orderId,
        externalOrderId: data.externalOrderId,
        totalAmount: data.totalAmount,
        itemCount: data.itemCount,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log payment method registered
   */
  async logPaymentMethodRegistered(data: {
    userId: string;
    faxJobId?: string;
    paymentMethodId: string;
    type: 'card' | 'konbini' | 'bank_transfer';
    isDefault: boolean;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      faxJobId: data.faxJobId,
      eventType: 'payment.method_registered',
      eventData: {
        paymentMethodId: data.paymentMethodId,
        type: data.type,
        isDefault: data.isDefault,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log bank transfer initiated
   */
  async logBankTransferInitiated(data: {
    userId: string;
    faxJobId?: string;
    transferId: string;
    amount: number;
    currency: string;
    bankName?: string;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      faxJobId: data.faxJobId,
      eventType: 'payment.bank_transfer_initiated',
      eventData: {
        transferId: data.transferId,
        amount: data.amount,
        currency: data.currency,
        bankName: data.bankName,
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
    paymentIntentId: string;
    amount: number;
    currency: string;
    status: string;
    paymentMethodId: string;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      faxJobId: data.faxJobId,
      eventType: 'payment.processed',
      eventData: {
        paymentIntentId: data.paymentIntentId,
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        paymentMethodId: data.paymentMethodId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log konbini barcode generated
   */
  async logKonbiniBarcodeGenerated(data: {
    userId: string;
    faxJobId?: string;
    paymentIntentId: string;
    amount: number;
    currency: string;
    expiresAt: Date;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      faxJobId: data.faxJobId,
      eventType: 'payment.konbini_barcode_generated',
      eventData: {
        paymentIntentId: data.paymentIntentId,
        amount: data.amount,
        currency: data.currency,
        expiresAt: data.expiresAt.toISOString(),
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
   * Log AI chat interaction
   */
  async logAIChatInteraction(data: {
    userId: string;
    faxJobId?: string;
    conversationId: string;
    userMessage: string;
    aiResponse: string;
    referenceId: string;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      faxJobId: data.faxJobId,
      eventType: 'ai.chat_interaction',
      eventData: {
        conversationId: data.conversationId,
        userMessage: data.userMessage,
        aiResponse: data.aiResponse,
        referenceId: data.referenceId,
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
   * Log user profile updated
   */
  async logUserProfileUpdated(data: {
    userId: string;
    field: string;
    oldValue?: any;
    newValue?: any;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      eventType: 'user.profile_updated',
      eventData: {
        field: data.field,
        oldValue: data.oldValue,
        newValue: data.newValue,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log contact added
   */
  async logContactAdded(data: {
    userId: string;
    contactId: string;
    name: string;
    emailAddress: string;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      eventType: 'contact.added',
      eventData: {
        contactId: data.contactId,
        name: data.name,
        emailAddress: data.emailAddress,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log contact updated
   */
  async logContactUpdated(data: {
    userId: string;
    contactId: string;
    changes: any;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      eventType: 'contact.updated',
      eventData: {
        contactId: data.contactId,
        changes: data.changes,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log contact deleted
   */
  async logContactDeleted(data: {
    userId: string;
    contactId: string;
    name: string;
    emailAddress: string;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      eventType: 'contact.deleted',
      eventData: {
        contactId: data.contactId,
        name: data.name,
        emailAddress: data.emailAddress,
        timestamp: new Date().toISOString(),
      },
    });
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
    // Only set userId if entityType is not 'system' and entityId looks like a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.entityId);
    
    await auditLogRepository.create({
      userId: data.entityType !== 'system' && isUUID ? data.entityId : undefined,
      faxJobId: data.entityType === 'fax_job' && isUUID ? data.entityId : undefined,
      eventType: `${data.entityType}.${data.operation}`,
      eventData: {
        ...data.details,
        entityId: data.entityId, // Store the actual entity ID in event data
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log product search
   */
  async logProductSearch(data: {
    userId: string;
    query: string;
    filters: any;
    resultCount: number;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      eventType: 'product.search',
      eventData: {
        query: data.query,
        filters: data.filters,
        resultCount: data.resultCount,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log product selection
   */
  async logProductSelection(data: {
    userId: string;
    faxJobId?: string;
    asin: string;
    productTitle: string;
    price: number;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      faxJobId: data.faxJobId,
      eventType: 'product.selected',
      eventData: {
        asin: data.asin,
        productTitle: data.productTitle,
        price: data.price,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log admin purchase action
   */
  async logAdminPurchase(data: {
    userId: string;
    orderId: string;
    adminUserId: string;
    amazonOrderId: string;
    actualPrice: number;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      eventType: 'admin.purchase_completed',
      eventData: {
        orderId: data.orderId,
        adminUserId: data.adminUserId,
        amazonOrderId: data.amazonOrderId,
        actualPrice: data.actualPrice,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Log order status change
   */
  async logOrderStatusChange(data: {
    userId: string;
    orderId: string;
    previousStatus: string;
    newStatus: string;
    reason?: string;
  }): Promise<void> {
    await auditLogRepository.create({
      userId: data.userId,
      eventType: 'order.status_changed',
      eventData: {
        orderId: data.orderId,
        previousStatus: data.previousStatus,
        newStatus: data.newStatus,
        reason: data.reason,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

export const auditLogService = new AuditLogService();
