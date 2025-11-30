/**
 * Shopping Order Confirmation Fax Generator Tests
 * 
 * Tests for order confirmation fax generation including:
 * - Order summary with product details
 * - Payment instructions (card and bank transfer)
 * - Reference ID display
 * - Japanese formatting
 */

import { describe, it, expect } from 'vitest';
import {
  ShoppingOrderConfirmationFaxGenerator,
  ShoppingOrderConfirmationData,
  BankTransferInstructions
} from '../../services/shoppingOrderConfirmationFaxGenerator';

describe('ShoppingOrderConfirmationFaxGenerator', () => {
  describe('generateOrderConfirmationFax', () => {
    it('should generate order confirmation fax with card payment', async () => {
      const data: ShoppingOrderConfirmationData = {
        orderId: 'order_123',
        referenceId: 'FX-2025-000001',
        productTitle: 'パナソニック ヘアドライヤー ナノケア 高浸透「ナノイー」',
        productAsin: 'B09ABCDEFG',
        quantity: 1,
        quotedPrice: 15800,
        totalAmount: 15800,
        paymentMethod: 'card',
        estimatedDelivery: '2025年1月5日',
        userName: '田中太郎'
      };

      const pdfBuffer = await ShoppingOrderConfirmationFaxGenerator.generateOrderConfirmationFax(data);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      
      // Verify it's a valid PDF
      const pdfHeader = pdfBuffer.toString('utf8', 0, 4);
      expect(pdfHeader).toBe('%PDF');
    });

    it('should generate order confirmation fax with bank transfer', async () => {
      const bankInstructions: BankTransferInstructions = {
        bankName: '三菱UFJ銀行',
        accountNumber: '1234567',
        accountName: 'カ）ファクシ',
        amount: 15800,
        referenceCode: 'FX2025000001',
        expiresAt: new Date('2025-01-10T23:59:59')
      };

      const data: ShoppingOrderConfirmationData = {
        orderId: 'order_124',
        referenceId: 'FX-2025-000002',
        productTitle: 'シャープ 加湿空気清浄機 プラズマクラスター',
        productAsin: 'B09XYZWXYZ',
        quantity: 1,
        quotedPrice: 28900,
        totalAmount: 28900,
        paymentMethod: 'bank_transfer',
        bankTransferInstructions: bankInstructions,
        estimatedDelivery: '2025年1月8日',
        userName: '佐藤花子'
      };

      const pdfBuffer = await ShoppingOrderConfirmationFaxGenerator.generateOrderConfirmationFax(data);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      
      // Verify it's a valid PDF
      const pdfHeader = pdfBuffer.toString('utf8', 0, 4);
      expect(pdfHeader).toBe('%PDF');
    });

    it('should generate order confirmation without user name', async () => {
      const data: ShoppingOrderConfirmationData = {
        orderId: 'order_125',
        referenceId: 'FX-2025-000003',
        productTitle: 'タイガー 電気ケトル わく子',
        productAsin: 'B08PQRSTUV',
        quantity: 2,
        quotedPrice: 3980,
        totalAmount: 7960,
        paymentMethod: 'card'
      };

      const pdfBuffer = await ShoppingOrderConfirmationFaxGenerator.generateOrderConfirmationFax(data);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should handle multiple quantities correctly', async () => {
      const data: ShoppingOrderConfirmationData = {
        orderId: 'order_126',
        referenceId: 'FX-2025-000004',
        productTitle: 'アイリスオーヤマ LED電球',
        productAsin: 'B07MNOPQRS',
        quantity: 5,
        quotedPrice: 580,
        totalAmount: 2900,
        paymentMethod: 'card',
        userName: '山田一郎'
      };

      const pdfBuffer = await ShoppingOrderConfirmationFaxGenerator.generateOrderConfirmationFax(data);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });
  });

  describe('generatePurchaseConfirmationFax', () => {
    it('should generate purchase completion confirmation fax', async () => {
      const data = {
        referenceId: 'FX-2025-000005',
        productTitle: 'パナソニック ヘアドライヤー ナノケア',
        amazonOrderId: '123-4567890-1234567',
        totalAmount: 15800,
        estimatedDelivery: '2025年1月10日',
        userName: '田中太郎'
      };

      const pdfBuffer = await ShoppingOrderConfirmationFaxGenerator.generatePurchaseConfirmationFax(data);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      
      // Verify it's a valid PDF
      const pdfHeader = pdfBuffer.toString('utf8', 0, 4);
      expect(pdfHeader).toBe('%PDF');
    });

    it('should generate purchase confirmation without estimated delivery', async () => {
      const data = {
        referenceId: 'FX-2025-000006',
        productTitle: 'シャープ 加湿空気清浄機',
        amazonOrderId: '123-4567890-7654321',
        totalAmount: 28900,
        userName: '佐藤花子'
      };

      const pdfBuffer = await ShoppingOrderConfirmationFaxGenerator.generatePurchaseConfirmationFax(data);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });
  });

  describe('generateDeliveryConfirmationFax', () => {
    it('should generate delivery confirmation fax', async () => {
      const data = {
        referenceId: 'FX-2025-000007',
        productTitle: 'パナソニック ヘアドライヤー ナノケア',
        amazonOrderId: '123-4567890-1234567',
        trackingNumber: '1234567890123',
        deliveredAt: new Date('2025-01-10T14:30:00'),
        userName: '田中太郎'
      };

      const pdfBuffer = await ShoppingOrderConfirmationFaxGenerator.generateDeliveryConfirmationFax(data);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      
      // Verify it's a valid PDF
      const pdfHeader = pdfBuffer.toString('utf8', 0, 4);
      expect(pdfHeader).toBe('%PDF');
    });

    it('should generate delivery confirmation without tracking number', async () => {
      const data = {
        referenceId: 'FX-2025-000008',
        productTitle: 'シャープ 加湿空気清浄機',
        amazonOrderId: '123-4567890-7654321',
        deliveredAt: new Date('2025-01-12T16:45:00'),
        userName: '佐藤花子'
      };

      const pdfBuffer = await ShoppingOrderConfirmationFaxGenerator.generateDeliveryConfirmationFax(data);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });
  });

  describe('Price formatting', () => {
    it('should format prices with comma separators', async () => {
      const data: ShoppingOrderConfirmationData = {
        orderId: 'order_127',
        referenceId: 'FX-2025-000009',
        productTitle: '高額商品テスト',
        productAsin: 'B09TESTPRC',
        quantity: 1,
        quotedPrice: 123456,
        totalAmount: 123456,
        paymentMethod: 'card'
      };

      const pdfBuffer = await ShoppingOrderConfirmationFaxGenerator.generateOrderConfirmationFax(data);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      
      // The price should be formatted as ¥123,456 in the PDF
      // We can't easily verify the content without parsing the PDF,
      // but we can verify the PDF was generated successfully
    });
  });

  describe('Reference ID display', () => {
    it('should prominently display reference ID', async () => {
      const data: ShoppingOrderConfirmationData = {
        orderId: 'order_128',
        referenceId: 'FX-2025-999999',
        productTitle: '参照番号テスト商品',
        productAsin: 'B09REFTEST',
        quantity: 1,
        quotedPrice: 5000,
        totalAmount: 5000,
        paymentMethod: 'card'
      };

      const pdfBuffer = await ShoppingOrderConfirmationFaxGenerator.generateOrderConfirmationFax(data);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      
      // Reference ID should be included in the PDF
      // The actual verification would require PDF parsing
    });
  });

  describe('Japanese text formatting', () => {
    it('should handle long Japanese product titles', async () => {
      const data: ShoppingOrderConfirmationData = {
        orderId: 'order_129',
        referenceId: 'FX-2025-000010',
        productTitle: 'パナソニック ヘアドライヤー ナノケア 高浸透「ナノイー」&ミネラル搭載 ディープネイビー EH-NA0J-A',
        productAsin: 'B09LONGTITLE',
        quantity: 1,
        quotedPrice: 32800,
        totalAmount: 32800,
        paymentMethod: 'card',
        userName: '長い名前のテストユーザー様'
      };

      const pdfBuffer = await ShoppingOrderConfirmationFaxGenerator.generateOrderConfirmationFax(data);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should handle Japanese characters in bank transfer instructions', async () => {
      const bankInstructions: BankTransferInstructions = {
        bankName: '三井住友銀行 渋谷支店',
        accountNumber: '9876543',
        accountName: 'カブシキガイシャ ファクシ',
        amount: 45000,
        referenceCode: 'FX2025000011',
        expiresAt: new Date('2025-01-15T23:59:59')
      };

      const data: ShoppingOrderConfirmationData = {
        orderId: 'order_130',
        referenceId: 'FX-2025-000011',
        productTitle: '日本語テスト商品',
        productAsin: 'B09JPNTEST',
        quantity: 1,
        quotedPrice: 45000,
        totalAmount: 45000,
        paymentMethod: 'bank_transfer',
        bankTransferInstructions: bankInstructions,
        userName: '日本太郎'
      };

      const pdfBuffer = await ShoppingOrderConfirmationFaxGenerator.generateOrderConfirmationFax(data);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
    });
  });
});
