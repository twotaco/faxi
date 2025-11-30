import { FaxTemplateEngine } from './faxTemplateEngine.js';
import { FaxGenerator } from './faxGenerator.js';
import { FaxTemplate, FaxContent, CircleOption } from '../types/fax.js';

export interface WelcomeFaxData {
  phoneNumber: string;
  emailAddress: string;
  userName?: string;
}

export class WelcomeFaxGenerator {
  /**
   * Generate welcome and onboarding fax for new users
   */
  static async generateWelcomeFax(
    data: WelcomeFaxData,
    referenceId?: string
  ): Promise<Buffer> {
    const template = this.createWelcomeTemplate(data, referenceId);
    return await FaxGenerator.generatePdf(template);
  }

  /**
   * Create welcome fax template
   */
  private static createWelcomeTemplate(
    data: WelcomeFaxData,
    referenceId?: string
  ): FaxTemplate {
    const refId = referenceId || FaxTemplateEngine.generateReferenceId();
    
    const content: FaxContent[] = [
      // Header
      {
        type: 'header',
        text: 'Faxi - Your Fax to Internet Bridge',
        fontSize: 12,
        bold: true,
        alignment: 'center',
        marginBottom: 16
      },
      
      // Welcome title
      {
        type: 'text',
        text: 'WELCOME TO FAXI!',
        fontSize: 18,
        bold: true,
        alignment: 'center',
        marginBottom: 16
      },
      
      // Thank you message
      {
        type: 'text',
        text: `Thank you for your first contact! Your fax machine is now connected to the internet.`,
        fontSize: 12,
        marginBottom: 16
      },
      
      // Email address section
      {
        type: 'text',
        text: 'YOUR DEDICATED EMAIL ADDRESS:',
        fontSize: 12,
        bold: true,
        marginBottom: 8
      },
      {
        type: 'text',
        text: data.emailAddress,
        fontSize: 14,
        bold: true,
        alignment: 'center',
        marginBottom: 16
      },
      {
        type: 'text',
        text: 'Anyone can send emails to this address and we\'ll fax them to you automatically!',
        fontSize: 11,
        marginBottom: 20
      },
      
      // What you can do section
      {
        type: 'text',
        text: 'WHAT YOU CAN DO WITH FAXI:',
        fontSize: 12,
        bold: true,
        marginBottom: 12
      },
      {
        type: 'text',
        text: '• SEND EMAILS: Fax us "Send email to friend@example.com: Hello!"',
        fontSize: 11,
        marginBottom: 6
      },
      {
        type: 'text',
        text: '• SHOP ONLINE: Fax us "I need batteries" or "Order shampoo"',
        fontSize: 11,
        marginBottom: 6
      },
      {
        type: 'text',
        text: '• ASK AI QUESTIONS: Fax us "What\'s the weather?" or "Recipe for cookies"',
        fontSize: 11,
        marginBottom: 6
      },
      {
        type: 'text',
        text: '• REGISTER PAYMENT: Fax us your credit card info for easy shopping',
        fontSize: 11,
        marginBottom: 20
      },
      
      // Optional information request
      {
        type: 'text',
        text: 'OPTIONAL - HELP US SERVE YOU BETTER:',
        fontSize: 12,
        bold: true,
        marginBottom: 12
      },
      {
        type: 'text',
        text: 'Circle topics you\'d like detailed help with:',
        fontSize: 11,
        marginBottom: 8
      }
    ];

    // Add help topic options
    const helpOptions: CircleOption[] = [
      {
        id: 'email_help',
        label: 'A',
        text: 'How to send and receive emails'
      },
      {
        id: 'shopping_help',
        label: 'B', 
        text: 'How to shop online safely'
      },
      {
        id: 'payment_help',
        label: 'C',
        text: 'How to register payment methods'
      },
      {
        id: 'ai_help',
        label: 'D',
        text: 'How to ask questions to AI'
      },
      {
        id: 'address_book_help',
        label: 'E',
        text: 'How to manage your contacts'
      }
    ];

    content.push({
      type: 'circle_option',
      options: helpOptions,
      marginBottom: 16
    });

    // Optional name request
    content.push({
      type: 'text',
      text: 'What should we call you? (Optional)',
      fontSize: 11,
      bold: true,
      marginBottom: 8
    });
    content.push({
      type: 'text',
      text: 'Name: ________________________',
      fontSize: 11,
      marginBottom: 20
    });

    // Getting started examples
    content.push({
      type: 'text',
      text: 'TRY THESE EXAMPLES TO GET STARTED:',
      fontSize: 12,
      bold: true,
      marginBottom: 12
    });
    content.push({
      type: 'text',
      text: '1. "Send email to son@example.com: Hi, this is from my fax!"',
      fontSize: 11,
      marginBottom: 6
    });
    content.push({
      type: 'text',
      text: '2. "What\'s the weather like today?"',
      fontSize: 11,
      marginBottom: 6
    });
    content.push({
      type: 'text',
      text: '3. "I need AA batteries"',
      fontSize: 11,
      marginBottom: 20
    });

    // Footer with reference ID and support
    content.push({
      type: 'footer',
      text: `Welcome! Ref: ${refId} | Support: help@faxi.jp | +81-3-1234-5678`,
      fontSize: 96, // 34pt minimum for reference ID prominence (96 pixels at 204 DPI ≈ 34pt)
      bold: true,
      alignment: 'center',
      marginTop: 16
    });

    return {
      type: 'welcome',
      referenceId: refId,
      pages: [{
        content,
        pageNumber: 1,
        totalPages: 1
      }],
      contextData: {
        phoneNumber: data.phoneNumber,
        emailAddress: data.emailAddress,
        userName: data.userName,
        isWelcomeFax: true
      }
    };
  }

  /**
   * Generate detailed help fax for specific topics
   */
  static async generateDetailedHelpFax(
    topic: 'email' | 'shopping' | 'payment' | 'ai' | 'address_book',
    referenceId?: string
  ): Promise<Buffer> {
    const template = this.createDetailedHelpTemplate(topic, referenceId);
    return await FaxGenerator.generatePdf(template);
  }

  /**
   * Create detailed help template for specific topics
   */
  private static createDetailedHelpTemplate(
    topic: 'email' | 'shopping' | 'payment' | 'ai' | 'address_book',
    referenceId?: string
  ): FaxTemplate {
    const refId = referenceId || FaxTemplateEngine.generateReferenceId();
    
    const helpContent = this.getHelpContent(topic);
    
    const content: FaxContent[] = [
      {
        type: 'header',
        text: 'Faxi - Your Fax to Internet Bridge',
        fontSize: 10,
        alignment: 'center',
        marginBottom: 12
      },
      {
        type: 'text',
        text: helpContent.title,
        fontSize: 16,
        bold: true,
        alignment: 'center',
        marginBottom: 16
      },
      {
        type: 'text',
        text: helpContent.description,
        fontSize: 12,
        marginBottom: 16
      }
    ];

    // Add examples
    if (helpContent.examples.length > 0) {
      content.push({
        type: 'text',
        text: 'EXAMPLES:',
        fontSize: 12,
        bold: true,
        marginBottom: 8
      });
      
      helpContent.examples.forEach((example, index) => {
        content.push({
          type: 'text',
          text: `${index + 1}. ${example}`,
          fontSize: 11,
          marginBottom: 6
        });
      });
      
      content.push({
        type: 'text',
        text: '',
        marginBottom: 16
      });
    }

    // Add tips
    if (helpContent.tips.length > 0) {
      content.push({
        type: 'text',
        text: 'HELPFUL TIPS:',
        fontSize: 12,
        bold: true,
        marginBottom: 8
      });
      
      helpContent.tips.forEach(tip => {
        content.push({
          type: 'text',
          text: `• ${tip}`,
          fontSize: 11,
          marginBottom: 6
        });
      });
    }

    content.push({
      type: 'footer',
      text: `Help Guide | Ref: ${refId} | Support: help@faxi.jp | +81-3-1234-5678`,
      fontSize: 96, // 34pt minimum for reference ID prominence (96 pixels at 204 DPI ≈ 34pt)
      bold: true,
      alignment: 'center',
      marginTop: 16
    });

    return {
      type: 'welcome',
      referenceId: refId,
      pages: [{
        content,
        pageNumber: 1,
        totalPages: 1
      }],
      contextData: {
        helpTopic: topic,
        isHelpFax: true
      }
    };
  }

  /**
   * Get help content for specific topics
   */
  private static getHelpContent(topic: 'email' | 'shopping' | 'payment' | 'ai' | 'address_book') {
    const helpContents = {
      email: {
        title: 'HOW TO SEND & RECEIVE EMAILS',
        description: 'Use your fax machine to send emails to anyone in the world. We\'ll also fax you any emails sent to your dedicated address.',
        examples: [
          'Send email to friend@example.com: Hello from my fax machine!',
          'Send email to doctor@clinic.jp: I need to reschedule my appointment',
          'Reply to email (when you receive one with quick reply options)'
        ],
        tips: [
          'Always start with "Send email to [address]:" followed by your message',
          'We automatically add contacts to your address book when you email them',
          'You can use names instead of email addresses for saved contacts',
          'We filter spam emails so you only get important messages'
        ]
      },
      shopping: {
        title: 'HOW TO SHOP ONLINE',
        description: 'Shop from major online stores by faxing us what you need. We\'ll find products, show you options, and handle the purchase.',
        examples: [
          'I need AA batteries',
          'Order shampoo and conditioner',
          'Buy a flashlight with batteries',
          'I want to order groceries for delivery'
        ],
        tips: [
          'Be specific about what you want (brand, size, quantity)',
          'We\'ll show you options with prices before you buy anything',
          'Register a payment method for faster checkout',
          'We suggest related items that might be useful'
        ]
      },
      payment: {
        title: 'HOW TO REGISTER PAYMENT METHODS',
        description: 'Register a credit card or use convenience store payment barcodes for easy and secure shopping.',
        examples: [
          'Register credit card: [Card Number] [Expiry] [Name on Card]',
          'Add payment method: Visa ending in 1234',
          'Use convenience store payment (we\'ll send you barcodes)'
        ],
        tips: [
          'Your payment info is stored securely with Stripe',
          'You can register multiple payment methods',
          'Convenience store barcodes work at FamilyMart, 7-Eleven, Lawson',
          'We never store your full credit card number'
        ]
      },
      ai: {
        title: 'HOW TO ASK AI QUESTIONS',
        description: 'Get answers to questions, help with problems, or just have a conversation with our AI assistant.',
        examples: [
          'What\'s the weather like today?',
          'How do I cook rice?',
          'What are the symptoms of a cold?',
          'Tell me a joke'
        ],
        tips: [
          'Ask questions in natural language, like talking to a person',
          'The AI can help with recipes, health info, general knowledge',
          'Conversations continue for 24 hours if you reference them',
          'Be specific for better answers'
        ]
      },
      address_book: {
        title: 'HOW TO MANAGE YOUR CONTACTS',
        description: 'Save email addresses with names so you can send emails using just the person\'s name or relationship.',
        examples: [
          'Add contact: Son - john@example.com',
          'Send email to Son: How are you doing?',
          'Add contact: Doctor - drsmith@clinic.jp',
          'Update contact: Mom - newmom@email.com'
        ],
        tips: [
          'We automatically add people when you email them',
          'Use relationships (Son, Doctor, Friend) or names',
          'You can update or delete contacts anytime',
          'Contacts make sending emails much easier'
        ]
      }
    };

    return helpContents[topic];
  }

  /**
   * Generate payment method registration instructions fax
   */
  static async generatePaymentRegistrationInstructionsFax(
    referenceId?: string
  ): Promise<Buffer> {
    const refId = referenceId || FaxTemplateEngine.generateReferenceId();
    
    const content: FaxContent[] = [
      {
        type: 'header',
        text: 'Faxi - Payment Method Registration',
        fontSize: 12,
        bold: true,
        alignment: 'center',
        marginBottom: 16
      },
      {
        type: 'text',
        text: 'REGISTER YOUR PAYMENT METHOD',
        fontSize: 16,
        bold: true,
        alignment: 'center',
        marginBottom: 16
      },
      {
        type: 'text',
        text: 'To make shopping easier, you can register a credit card for automatic payment.',
        fontSize: 12,
        marginBottom: 16
      },
      {
        type: 'text',
        text: 'HOW TO REGISTER:',
        fontSize: 12,
        bold: true,
        marginBottom: 8
      },
      {
        type: 'text',
        text: 'Fax us your credit card information in this format:',
        fontSize: 11,
        marginBottom: 8
      },
      {
        type: 'text',
        text: 'Register credit card:',
        fontSize: 11,
        bold: true,
        marginBottom: 4
      },
      {
        type: 'text',
        text: 'Card Number: ________________',
        fontSize: 11,
        marginBottom: 4
      },
      {
        type: 'text',
        text: 'Expiry Date: ___/___',
        fontSize: 11,
        marginBottom: 4
      },
      {
        type: 'text',
        text: 'Name on Card: ________________',
        fontSize: 11,
        marginBottom: 4
      },
      {
        type: 'text',
        text: 'Security Code: ___',
        fontSize: 11,
        marginBottom: 16
      },
      {
        type: 'text',
        text: 'SECURITY:',
        fontSize: 12,
        bold: true,
        marginBottom: 8
      },
      {
        type: 'text',
        text: '• Your information is encrypted and stored securely with Stripe',
        fontSize: 11,
        marginBottom: 4
      },
      {
        type: 'text',
        text: '• We never store your full card number',
        fontSize: 11,
        marginBottom: 4
      },
      {
        type: 'text',
        text: '• You can remove your payment method anytime',
        fontSize: 11,
        marginBottom: 16
      },
      {
        type: 'text',
        text: 'ALTERNATIVE: Use convenience store payment barcodes (no registration needed)',
        fontSize: 11,
        marginBottom: 16
      },
      {
        type: 'footer',
        text: `Payment Registration | Ref: ${refId} | Support: help@faxi.jp | +81-3-1234-5678`,
        fontSize: 96, // 34pt minimum for reference ID prominence (96 pixels at 204 DPI ≈ 34pt)
        bold: true,
        alignment: 'center',
        marginTop: 16
      }
    ];

    const template: FaxTemplate = {
      type: 'welcome',
      referenceId: refId,
      pages: [{
        content,
        pageNumber: 1,
        totalPages: 1
      }],
      contextData: {
        isPaymentInstructions: true
      }
    };

    return await FaxGenerator.generatePdf(template);
  }
}