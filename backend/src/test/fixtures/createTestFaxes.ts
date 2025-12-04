import { createCanvas } from 'canvas';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export interface TestFaxFixture {
  filename: string;
  description: string;
  scenario: string;
  expectedIntent: string;
  buffer: Buffer;
}

export class TestFaxFixtureGenerator {
  private outputDir: string;
  private canvasWidth = 1728; // Standard fax width at 204 DPI
  private canvasHeight = 2200; // Standard fax height for letter size

  constructor(outputDir?: string) {
    this.outputDir = outputDir || join(process.cwd(), 'src', 'test', 'fixtures', 'fax-images');
    
    // Ensure output directory exists
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate all test fax fixtures
   */
  generateAllFixtures(): TestFaxFixture[] {
    const fixtures: TestFaxFixture[] = [
      this.createEmailRequestFax(),
      this.createShoppingRequestFax(),
      this.createMultiProductShoppingFax(),
      this.createJapaneseShoppingFax(),
      this.createAIChatRequestFax(),
      this.createAppointmentRequestFax(),
      this.createPaymentRegistrationFax(),
      this.createEmailReplyWithCircles(),
      this.createProductSelectionWithCheckmarks(),
      this.createAmbiguousRequestFax(),
      this.createPoorHandwritingFax(),
      this.createMultiActionRequestFax(),
      this.createBlankReplyWithReference(),
    ];

    // Save all fixtures to disk
    fixtures.forEach(fixture => {
      const filePath = join(this.outputDir, fixture.filename);
      writeFileSync(filePath, fixture.buffer);
      console.log(`Generated test fax: ${fixture.filename}`);
    });

    return fixtures;
  }

  /**
   * Create email request fax
   */
  private createEmailRequestFax(): TestFaxFixture {
    const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Black text
    ctx.fillStyle = 'black';
    ctx.font = '48px Arial';

    // Header
    ctx.fillText('Email Request', 100, 150);
    
    ctx.font = '36px Arial';
    ctx.fillText('Please send email to:', 100, 250);
    ctx.fillText('john@example.com', 100, 320);
    
    ctx.fillText('Subject: Meeting Tomorrow', 100, 420);
    
    ctx.fillText('Message:', 100, 520);
    ctx.font = '32px Arial';
    ctx.fillText('Hi John,', 100, 580);
    ctx.fillText('Can we meet tomorrow at 2pm?', 100, 630);
    ctx.fillText('Let me know if that works.', 100, 680);
    ctx.fillText('Thanks!', 100, 730);

    const buffer = canvas.toBuffer('image/png');
    
    return {
      filename: 'email_request.png',
      description: 'Simple email request with recipient, subject, and message',
      scenario: 'User wants to send an email to a specific address',
      expectedIntent: 'email',
      buffer,
    };
  }

  /**
   * Create shopping request fax (single product)
   */
  private createShoppingRequestFax(): TestFaxFixture {
    const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.fillStyle = 'black';
    ctx.font = '48px Arial';
    ctx.fillText('Shopping Request', 100, 150);
    
    ctx.font = '36px Arial';
    ctx.fillText('I need shampoo', 100, 250);
    
    ctx.font = '32px Arial';
    ctx.fillText('Preferably for dry hair', 100, 320);
    ctx.fillText('Under ¥1000', 100, 370);

    const buffer = canvas.toBuffer('image/png');
    
    return {
      filename: 'shopping_request.png',
      description: 'Simple shopping request for single product (shampoo)',
      scenario: 'User wants to purchase a single item',
      expectedIntent: 'shopping',
      buffer,
    };
  }

  /**
   * Create multi-product shopping fax
   */
  private createMultiProductShoppingFax(): TestFaxFixture {
    const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.fillStyle = 'black';
    ctx.font = '48px Arial';
    ctx.fillText('Shopping List', 100, 150);
    
    ctx.font = '36px Arial';
    ctx.fillText('I need:', 100, 250);
    
    ctx.font = '32px Arial';
    ctx.fillText('• Shampoo', 100, 320);
    ctx.fillText('• Crackers (vegetable flavor)', 100, 380);
    ctx.fillText('• Flashlight', 100, 440);

    const buffer = canvas.toBuffer('image/png');
    
    return {
      filename: 'multi_product_shopping.png',
      description: 'Multi-product shopping request (shampoo, crackers, flashlight)',
      scenario: 'User wants to purchase multiple different products',
      expectedIntent: 'shopping',
      buffer,
    };
  }

  /**
   * Create Japanese shopping fax
   */
  private createJapaneseShoppingFax(): TestFaxFixture {
    const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.fillStyle = 'black';
    ctx.font = '48px Arial';
    ctx.fillText('買い物リクエスト', 100, 150);
    
    ctx.font = '36px Arial';
    ctx.fillText('シャンプーが欲しい', 100, 250);
    
    ctx.font = '32px Arial';
    ctx.fillText('乾燥した髪用', 100, 320);
    ctx.fillText('1000円以下', 100, 370);

    const buffer = canvas.toBuffer('image/png');
    
    return {
      filename: 'japanese_shopping.png',
      description: 'Japanese shopping request for shampoo',
      scenario: 'Japanese user requests product in native language',
      expectedIntent: 'shopping',
      buffer,
    };
  }

  /**
   * Create appointment request fax
   */
  private createAppointmentRequestFax(): TestFaxFixture {
    const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.fillStyle = 'black';
    ctx.font = '48px Arial';
    ctx.fillText('Appointment Request', 100, 150);
    
    ctx.font = '36px Arial';
    ctx.fillText('I need to book:', 100, 250);
    
    ctx.font = '32px Arial';
    ctx.fillText('Doctor appointment', 100, 320);
    ctx.fillText('Next week, any afternoon', 100, 370);
    ctx.fillText('Dr. Tanaka if possible', 100, 420);

    const buffer = canvas.toBuffer('image/png');
    
    return {
      filename: 'appointment_request.png',
      description: 'Appointment booking request for doctor',
      scenario: 'User wants to schedule a medical appointment',
      expectedIntent: 'appointment',
      buffer,
    };
  }

  /**
   * Create AI chat request fax
   */
  private createAIChatRequestFax(): TestFaxFixture {
    const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.fillStyle = 'black';
    ctx.font = '48px Arial';
    ctx.fillText('Question for AI', 100, 150);
    
    ctx.font = '36px Arial';
    ctx.fillText('What is the weather like', 100, 250);
    ctx.fillText('in Tokyo this week?', 100, 300);
    
    ctx.fillText('Also, can you recommend', 100, 400);
    ctx.fillText('some good restaurants', 100, 450);
    ctx.fillText('near Tokyo Station?', 100, 500);

    const buffer = canvas.toBuffer('image/png');
    
    return {
      filename: 'ai_chat_request.png',
      description: 'AI chat request with weather and restaurant questions',
      scenario: 'User wants to ask AI assistant questions',
      expectedIntent: 'ai_chat',
      buffer,
    };
  }

  /**
   * Create payment registration fax
   */
  private createPaymentRegistrationFax(): TestFaxFixture {
    const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.fillStyle = 'black';
    ctx.font = '48px Arial';
    ctx.fillText('Payment Registration', 100, 150);
    
    ctx.font = '36px Arial';
    ctx.fillText('Please register my credit card:', 100, 250);
    
    ctx.font = '32px Arial';
    ctx.fillText('Card Number: 4111 1111 1111 1111', 100, 320);
    ctx.fillText('Expiry: 12/25', 100, 370);
    ctx.fillText('Name: John Smith', 100, 420);
    
    ctx.fillText('Use for future purchases', 100, 520);

    const buffer = canvas.toBuffer('image/png');
    
    return {
      filename: 'payment_registration.png',
      description: 'Payment method registration with credit card details',
      scenario: 'User wants to register a payment method',
      expectedIntent: 'payment_registration',
      buffer,
    };
  }

  /**
   * Create email reply with circles (visual annotations)
   */
  private createEmailReplyWithCircles(): TestFaxFixture {
    const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.fillStyle = 'black';
    ctx.font = '32px Arial';
    ctx.fillText('Ref: FX-2024-001234', 100, 100);
    
    ctx.font = '36px Arial';
    ctx.fillText('Quick Reply Options:', 100, 200);
    
    ctx.font = '32px Arial';
    ctx.fillText('A. Yes, Thursday works', 150, 280);
    ctx.fillText('B. No, I\'m not available', 150, 330);
    ctx.fillText('C. Can we do a different day?', 150, 380);

    // Draw circles (visual annotations)
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    
    // Circle around option A (selected)
    ctx.beginPath();
    ctx.arc(120, 275, 20, 0, 2 * Math.PI);
    ctx.stroke();

    // Fill the circle to show selection
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(120, 275, 15, 0, 2 * Math.PI);
    ctx.fill();

    const buffer = canvas.toBuffer('image/png');
    
    return {
      filename: 'email_reply_with_circles.png',
      description: 'Email reply form with circled selection (option A)',
      scenario: 'User replying to email with quick reply options',
      expectedIntent: 'email',
      buffer,
    };
  }

  /**
   * Create product selection with checkmarks
   */
  private createProductSelectionWithCheckmarks(): TestFaxFixture {
    const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.fillStyle = 'black';
    ctx.font = '32px Arial';
    ctx.fillText('Ref: FX-2024-001235', 100, 100);
    
    ctx.font = '36px Arial';
    ctx.fillText('Product Selection:', 100, 200);
    
    ctx.font = '32px Arial';
    ctx.fillText('☐ A. Brand X Shampoo - ¥850', 150, 280);
    ctx.fillText('☐ B. Brand Y Shampoo - ¥650', 150, 330);
    ctx.fillText('☐ C. Hand soap - ¥320', 150, 380);

    // Draw checkmarks
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 4;
    
    // Checkmark for option A
    ctx.beginPath();
    ctx.moveTo(160, 285);
    ctx.lineTo(170, 295);
    ctx.lineTo(185, 270);
    ctx.stroke();

    // Checkmark for option C
    ctx.beginPath();
    ctx.moveTo(160, 385);
    ctx.lineTo(170, 395);
    ctx.lineTo(185, 370);
    ctx.stroke();

    const buffer = canvas.toBuffer('image/png');
    
    return {
      filename: 'product_selection_with_checkmarks.png',
      description: 'Product selection form with checkmarks on options A and C',
      scenario: 'User selecting products from a shopping form',
      expectedIntent: 'shopping',
      buffer,
    };
  }

  /**
   * Create ambiguous request fax
   */
  private createAmbiguousRequestFax(): TestFaxFixture {
    const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.fillStyle = 'black';
    ctx.font = '36px Arial';
    ctx.fillText('Need help with something', 100, 200);
    ctx.fillText('Can you do that thing?', 100, 280);
    ctx.fillText('You know what I mean', 100, 360);

    const buffer = canvas.toBuffer('image/png');
    
    return {
      filename: 'ambiguous_request.png',
      description: 'Ambiguous request that should trigger clarification',
      scenario: 'User sends unclear request requiring clarification',
      expectedIntent: 'unknown',
      buffer,
    };
  }

  /**
   * Create poor handwriting fax (simulated)
   */
  private createPoorHandwritingFax(): TestFaxFixture {
    const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.fillStyle = 'black';
    
    // Simulate poor handwriting with irregular text
    ctx.font = '32px cursive';
    ctx.save();
    ctx.rotate(-0.05); // Slight rotation
    ctx.fillText('send emal to mom', 120, 220);
    ctx.restore();
    
    ctx.save();
    ctx.rotate(0.03);
    ctx.fillText('tel her i wil cal', 110, 280);
    ctx.restore();
    
    ctx.save();
    ctx.rotate(-0.02);
    ctx.fillText('tomorow at 3pm', 130, 340);
    ctx.restore();

    // Add some noise/artifacts
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * this.canvasWidth;
      const y = Math.random() * this.canvasHeight;
      ctx.fillRect(x, y, 2, 2);
    }

    const buffer = canvas.toBuffer('image/png');
    
    return {
      filename: 'poor_handwriting.png',
      description: 'Poor handwriting with spelling errors and artifacts',
      scenario: 'User with poor handwriting sends email request',
      expectedIntent: 'email',
      buffer,
    };
  }

  /**
   * Create multi-action request fax
   */
  private createMultiActionRequestFax(): TestFaxFixture {
    const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.fillStyle = 'black';
    ctx.font = '36px Arial';
    ctx.fillText('Multiple Requests:', 100, 150);
    
    ctx.font = '32px Arial';
    ctx.fillText('1. Send email to son@example.com', 100, 220);
    ctx.fillText('   Tell him dinner is at 6pm', 120, 260);
    
    ctx.fillText('2. Buy groceries:', 100, 340);
    ctx.fillText('   - Milk, bread, eggs', 120, 380);
    
    ctx.fillText('3. Ask AI: What\'s the weather', 100, 460);
    ctx.fillText('   forecast for this weekend?', 120, 500);

    const buffer = canvas.toBuffer('image/png');
    
    return {
      filename: 'multi_action_request.png',
      description: 'Multiple actions in one fax: email, shopping, and AI chat',
      scenario: 'User requests multiple different actions in single fax',
      expectedIntent: 'multi_action',
      buffer,
    };
  }

  /**
   * Create blank reply with reference ID
   */
  private createBlankReplyWithReference(): TestFaxFixture {
    const canvas = createCanvas(this.canvasWidth, this.canvasHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    ctx.fillStyle = 'black';
    ctx.font = '32px Arial';
    ctx.fillText('Ref: FX-2024-001240', 100, 150);
    
    // Simulate handwritten response
    ctx.font = '28px cursive';
    ctx.fillText('Yes, I want the flashlight', 100, 250);
    ctx.fillText('and the batteries too', 100, 300);

    const buffer = canvas.toBuffer('image/png');
    
    return {
      filename: 'blank_reply_with_reference.png',
      description: 'Handwritten reply on blank page with reference ID',
      scenario: 'User replies on blank paper but includes reference ID',
      expectedIntent: 'shopping',
      buffer,
    };
  }

  /**
   * Get fixture by filename
   */
  getFixture(filename: string): Buffer | null {
    const filePath = join(this.outputDir, filename);
    try {
      const fs = require('fs');
      return fs.readFileSync(filePath);
    } catch (error) {
      return null;
    }
  }

  /**
   * List all available fixtures
   */
  listFixtures(): string[] {
    const fs = require('fs');
    try {
      return fs.readdirSync(this.outputDir).filter((file: string) =>
        file.endsWith('.png') || file.endsWith('.pdf')
      );
    } catch (error) {
      return [];
    }
  }
}

// Export singleton instance
export const testFaxFixtureGenerator = new TestFaxFixtureGenerator();

// Generate fixtures if this file is run directly
if (require.main === module) {
  console.log('Generating test fax fixtures...');
  const fixtures = testFaxFixtureGenerator.generateAllFixtures();
  console.log(`Generated ${fixtures.length} test fax fixtures:`);
  fixtures.forEach(fixture => {
    console.log(`  - ${fixture.filename}: ${fixture.description}`);
  });
}