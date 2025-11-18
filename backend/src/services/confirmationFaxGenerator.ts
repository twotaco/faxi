import { FaxTemplateEngine } from './faxTemplateEngine.js';
import { TiffGenerator } from './tiffGenerator.js';
import { ConfirmationData, FaxTemplate, ProductOption } from '../types/fax.js';

export interface OrderConfirmationDetails {
  orderId: string;
  trackingNumber?: string;
  items: ProductOption[];
  totalAmount: number;
  currency: string;
  estimatedDelivery: string;
  deliveryAddress: string;
  paymentMethod: string;
}

export interface EmailConfirmationDetails {
  recipient: string;
  subject: string;
  sentAt: Date;
  messagePreview?: string;
}

export interface GeneralActionDetails {
  actionType: string;
  description: string;
  result: string;
  nextSteps?: string[];
}

export class ConfirmationFaxGenerator {
  /**
   * Generate order confirmation fax
   */
  static async generateOrderConfirmationFax(
    orderDetails: OrderConfirmationDetails,
    referenceId?: string
  ): Promise<Buffer[]> {
    const itemsList = orderDetails.items
      .map(item => `• ${item.name} - ¥${item.price}`)
      .join('\n');

    const confirmationMessage = `Your order has been placed successfully!

Order Details:
Order ID: ${orderDetails.orderId}
${orderDetails.trackingNumber ? `Tracking: ${orderDetails.trackingNumber}` : ''}

Items Ordered:
${itemsList}

Total: ¥${orderDetails.totalAmount}
Payment: ${orderDetails.paymentMethod}

Delivery:
Address: ${orderDetails.deliveryAddress}
Estimated: ${orderDetails.estimatedDelivery}

${orderDetails.trackingNumber 
  ? 'You can track your package using the tracking number above.'
  : 'You will receive tracking information once your order ships.'
}

Thank you for your order!`;

    const confirmationData: ConfirmationData = {
      type: 'order',
      orderId: orderDetails.orderId,
      trackingNumber: orderDetails.trackingNumber,
      message: confirmationMessage,
      details: orderDetails
    };

    const template = FaxTemplateEngine.createConfirmationTemplate(confirmationData, referenceId);
    return await TiffGenerator.generateTiff(template);
  }

  /**
   * Generate email sent confirmation fax
   */
  static async generateEmailConfirmationFax(
    emailDetails: EmailConfirmationDetails,
    referenceId?: string
  ): Promise<Buffer[]> {
    const confirmationMessage = `Your email has been sent successfully!

Email Details:
To: ${emailDetails.recipient}
Subject: ${emailDetails.subject}
Sent: ${emailDetails.sentAt.toLocaleString('ja-JP')}

${emailDetails.messagePreview 
  ? `Message Preview:\n"${emailDetails.messagePreview.substring(0, 100)}${emailDetails.messagePreview.length > 100 ? '...' : ''}"`
  : ''
}

Your email has been delivered to ${emailDetails.recipient}.

If you receive a reply, we'll fax it to you automatically.`;

    const confirmationData: ConfirmationData = {
      type: 'email',
      emailRecipient: emailDetails.recipient,
      message: confirmationMessage,
      details: emailDetails
    };

    const template = FaxTemplateEngine.createConfirmationTemplate(confirmationData, referenceId);
    return await TiffGenerator.generateTiff(template);
  }

  /**
   * Generate general action confirmation fax
   */
  static async generateGeneralConfirmationFax(
    actionDetails: GeneralActionDetails,
    referenceId?: string
  ): Promise<Buffer[]> {
    let confirmationMessage = `Action completed successfully!

Action: ${actionDetails.actionType}
Description: ${actionDetails.description}
Result: ${actionDetails.result}`;

    if (actionDetails.nextSteps && actionDetails.nextSteps.length > 0) {
      confirmationMessage += `\n\nNext Steps:\n${actionDetails.nextSteps.map(step => `• ${step}`).join('\n')}`;
    }

    const confirmationData: ConfirmationData = {
      type: 'general',
      message: confirmationMessage,
      details: actionDetails
    };

    const template = FaxTemplateEngine.createConfirmationTemplate(confirmationData, referenceId);
    return await TiffGenerator.generateTiff(template);
  }

  /**
   * Generate payment method registration confirmation fax
   */
  static async generatePaymentRegistrationConfirmationFax(
    paymentMethodType: 'credit_card' | 'bank_account',
    maskedDetails: string,
    referenceId?: string
  ): Promise<Buffer[]> {
    const actionDetails: GeneralActionDetails = {
      actionType: 'Payment Method Registration',
      description: `Registered new ${paymentMethodType.replace('_', ' ')}`,
      result: `Payment method added: ${maskedDetails}`,
      nextSteps: [
        'You can now make purchases without entering payment details',
        'We\'ll charge this payment method for future orders',
        'You can add more payment methods anytime'
      ]
    };

    return await this.generateGeneralConfirmationFax(actionDetails, referenceId);
  }

  /**
   * Generate address book update confirmation fax
   */
  static async generateAddressBookConfirmationFax(
    action: 'added' | 'updated' | 'deleted',
    contactName: string,
    contactEmail?: string,
    referenceId?: string
  ): Promise<Buffer[]> {
    const actionMap = {
      added: 'Added new contact',
      updated: 'Updated contact',
      deleted: 'Deleted contact'
    };

    const actionDetails: GeneralActionDetails = {
      actionType: 'Address Book Update',
      description: actionMap[action],
      result: `Contact "${contactName}"${contactEmail ? ` (${contactEmail})` : ''} has been ${action}`,
      nextSteps: action === 'deleted' ? [] : [
        'You can now send emails using just the contact name',
        'The contact will appear in your address book',
        'We\'ll automatically recognize this contact in future emails'
      ]
    };

    return await this.generateGeneralConfirmationFax(actionDetails, referenceId);
  }

  /**
   * Generate subscription confirmation fax
   */
  static async generateSubscriptionConfirmationFax(
    subscriptionName: string,
    monthlyAmount: number,
    nextBillingDate: Date,
    features: string[],
    referenceId?: string
  ): Promise<Buffer[]> {
    const confirmationMessage = `Subscription activated successfully!

Subscription: ${subscriptionName}
Monthly Cost: ¥${monthlyAmount}
Next Billing: ${nextBillingDate.toLocaleDateString('ja-JP')}

Included Features:
${features.map(feature => `• ${feature}`).join('\n')}

Your subscription is now active and will automatically renew monthly.

To cancel or modify your subscription, fax us: "Cancel ${subscriptionName} subscription"`;

    const confirmationData: ConfirmationData = {
      type: 'general',
      message: confirmationMessage,
      details: {
        subscriptionName,
        monthlyAmount,
        nextBillingDate,
        features
      }
    };

    const template = FaxTemplateEngine.createConfirmationTemplate(confirmationData, referenceId);
    return await TiffGenerator.generateTiff(template);
  }

  /**
   * Generate service cancellation confirmation fax
   */
  static async generateCancellationConfirmationFax(
    serviceName: string,
    cancellationDate: Date,
    refundAmount?: number,
    referenceId?: string
  ): Promise<Buffer[]> {
    let confirmationMessage = `Service cancellation confirmed.

Service: ${serviceName}
Cancellation Date: ${cancellationDate.toLocaleDateString('ja-JP')}`;

    if (refundAmount && refundAmount > 0) {
      confirmationMessage += `\nRefund Amount: ¥${refundAmount}
Refund will be processed within 3-5 business days.`;
    }

    confirmationMessage += `\n\nYour service will remain active until ${cancellationDate.toLocaleDateString('ja-JP')}.

Thank you for using our service. You can reactivate anytime by faxing us.`;

    const confirmationData: ConfirmationData = {
      type: 'general',
      message: confirmationMessage,
      details: {
        serviceName,
        cancellationDate,
        refundAmount
      }
    };

    const template = FaxTemplateEngine.createConfirmationTemplate(confirmationData, referenceId);
    return await TiffGenerator.generateTiff(template);
  }

  /**
   * Generate multi-action confirmation fax (when multiple actions were completed)
   */
  static async generateMultiActionConfirmationFax(
    actions: Array<{
      type: string;
      description: string;
      result: string;
    }>,
    referenceId?: string
  ): Promise<Buffer[]> {
    const confirmationMessage = `Multiple actions completed successfully!

Completed Actions:
${actions.map((action, index) => 
  `${index + 1}. ${action.type}
   ${action.description}
   Result: ${action.result}`
).join('\n\n')}

All requested actions have been processed.`;

    const confirmationData: ConfirmationData = {
      type: 'general',
      message: confirmationMessage,
      details: { actions }
    };

    const template = FaxTemplateEngine.createConfirmationTemplate(confirmationData, referenceId);
    return await TiffGenerator.generateTiff(template);
  }

  /**
   * Generate delivery notification fax
   */
  static async generateDeliveryNotificationFax(
    orderId: string,
    trackingNumber: string,
    deliveryStatus: 'shipped' | 'out_for_delivery' | 'delivered',
    estimatedDelivery?: string,
    referenceId?: string
  ): Promise<Buffer[]> {
    const statusMessages = {
      shipped: 'Your order has been shipped!',
      out_for_delivery: 'Your order is out for delivery!',
      delivered: 'Your order has been delivered!'
    };

    let confirmationMessage = `${statusMessages[deliveryStatus]}

Order ID: ${orderId}
Tracking Number: ${trackingNumber}`;

    if (deliveryStatus === 'shipped' && estimatedDelivery) {
      confirmationMessage += `\nEstimated Delivery: ${estimatedDelivery}`;
    } else if (deliveryStatus === 'out_for_delivery') {
      confirmationMessage += `\nExpected delivery today.`;
    } else if (deliveryStatus === 'delivered') {
      confirmationMessage += `\nDelivered: ${new Date().toLocaleDateString('ja-JP')}`;
    }

    confirmationMessage += `\n\nYou can track your package using the tracking number above.

Thank you for your order!`;

    const confirmationData: ConfirmationData = {
      type: 'order',
      orderId,
      trackingNumber,
      message: confirmationMessage,
      details: { deliveryStatus, estimatedDelivery }
    };

    const template = FaxTemplateEngine.createConfirmationTemplate(confirmationData, referenceId);
    return await TiffGenerator.generateTiff(template);
  }
}