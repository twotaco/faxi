import { describe, it, expect, beforeEach } from 'vitest';
import { visualAnnotationDetector } from '../../services/visualAnnotationDetector';
import { VisualAnnotation } from '../../types/vision';

describe('Product Selection Detection', () => {
  const mockShoppingContext = {
    searchQuery: 'shampoo',
    searchResults: [
      {
        asin: 'B08N5WRWNW',
        title: 'Pantene Extra Damage Care Shampoo',
        price: 598,
        selectionMarker: 'A',
        imageUrl: 'https://example.com/image-a.jpg',
        primeEligible: true,
        deliveryEstimate: '明日お届け'
      },
      {
        asin: 'B07XYZABC1',
        title: 'Dove Intensive Repair Shampoo',
        price: 750,
        selectionMarker: 'B',
        imageUrl: 'https://example.com/image-b.jpg',
        primeEligible: true,
        deliveryEstimate: '明日お届け'
      },
      {
        asin: 'B09ABCDEF2',
        title: 'Tsubaki Premium Moist Shampoo',
        price: 1200,
        selectionMarker: 'C',
        imageUrl: 'https://example.com/image-c.jpg',
        primeEligible: true,
        deliveryEstimate: '2日後お届け'
      }
    ]
  };

  describe('detectProductSelection', () => {
    it('should detect single circle selection', async () => {
      const annotations: VisualAnnotation[] = [
        {
          type: 'circle',
          boundingBox: { x: 100, y: 200, width: 30, height: 30 },
          associatedText: 'B',
          confidence: 0.9,
          color: '#EF4444'
        }
      ];

      const result = await visualAnnotationDetector.detectProductSelection(
        annotations,
        'Product options fax with circle around B',
        mockShoppingContext
      );

      expect(result.success).toBe(true);
      expect(result.selectedProduct).toBeDefined();
      expect(result.selectedProduct?.asin).toBe('B07XYZABC1');
      expect(result.selectedProduct?.selectionMarker).toBe('B');
      expect(result.needsClarification).toBe(false);
    });

    it('should detect checkmark selection', async () => {
      const annotations: VisualAnnotation[] = [
        {
          type: 'checkmark',
          boundingBox: { x: 50, y: 150, width: 20, height: 20 },
          associatedText: 'A',
          confidence: 0.85,
          color: '#10B981'
        }
      ];

      const result = await visualAnnotationDetector.detectProductSelection(
        annotations,
        'Product options with checkmark next to A',
        mockShoppingContext
      );

      expect(result.success).toBe(true);
      expect(result.selectedProduct).toBeDefined();
      expect(result.selectedProduct?.asin).toBe('B08N5WRWNW');
      expect(result.selectedProduct?.selectionMarker).toBe('A');
    });

    it('should handle multiple selections with clarification', async () => {
      const annotations: VisualAnnotation[] = [
        {
          type: 'circle',
          boundingBox: { x: 100, y: 200, width: 30, height: 30 },
          associatedText: 'A',
          confidence: 0.9,
          color: '#EF4444'
        },
        {
          type: 'circle',
          boundingBox: { x: 100, y: 300, width: 30, height: 30 },
          associatedText: 'B',
          confidence: 0.85,
          color: '#EF4444'
        }
      ];

      const result = await visualAnnotationDetector.detectProductSelection(
        annotations,
        'Multiple circles',
        mockShoppingContext
      );

      expect(result.success).toBe(false);
      expect(result.needsClarification).toBe(true);
      expect(result.clarificationMessage).toContain('multiple selections');
      expect(result.detectedMarkers).toEqual(['A', 'B']);
    });

    it('should handle no selection detected', async () => {
      const annotations: VisualAnnotation[] = [
        {
          type: 'underline',
          boundingBox: { x: 100, y: 200, width: 100, height: 5 },
          associatedText: 'some text',
          confidence: 0.7,
          color: '#F59E0B'
        }
      ];

      const result = await visualAnnotationDetector.detectProductSelection(
        annotations,
        'No clear selection',
        mockShoppingContext
      );

      expect(result.success).toBe(false);
      expect(result.needsClarification).toBe(true);
      expect(result.clarificationMessage).toContain('could not detect');
    });

    it('should handle invalid marker selection', async () => {
      const annotations: VisualAnnotation[] = [
        {
          type: 'circle',
          boundingBox: { x: 100, y: 200, width: 30, height: 30 },
          associatedText: 'F', // Invalid marker
          confidence: 0.9,
          color: '#EF4444'
        }
      ];

      const result = await visualAnnotationDetector.detectProductSelection(
        annotations,
        'Circle around F',
        mockShoppingContext
      );

      expect(result.success).toBe(false);
      expect(result.needsClarification).toBe(true);
      expect(result.clarificationMessage).toContain('not available in the product list');
      expect(result.detectedMarkers).toEqual(['F']);
    });

    it('should handle missing shopping context', async () => {
      const annotations: VisualAnnotation[] = [
        {
          type: 'circle',
          boundingBox: { x: 100, y: 200, width: 30, height: 30 },
          associatedText: 'A',
          confidence: 0.9,
          color: '#EF4444'
        }
      ];

      const result = await visualAnnotationDetector.detectProductSelection(
        annotations,
        'Circle around A',
        null
      );

      expect(result.success).toBe(false);
      expect(result.needsClarification).toBe(true);
      expect(result.error).toContain('No shopping context');
    });

    it('should extract selection from text patterns', async () => {
      const annotations: VisualAnnotation[] = [];
      const extractedText = '選択: B';

      const result = await visualAnnotationDetector.detectProductSelection(
        annotations,
        extractedText,
        mockShoppingContext
      );

      expect(result.success).toBe(true);
      expect(result.selectedProduct?.selectionMarker).toBe('B');
    });

    it('should handle Japanese circle markers', async () => {
      const annotations: VisualAnnotation[] = [];
      const extractedText = '○C を選びます';

      const result = await visualAnnotationDetector.detectProductSelection(
        annotations,
        extractedText,
        mockShoppingContext
      );

      expect(result.success).toBe(true);
      expect(result.selectedProduct?.selectionMarker).toBe('C');
    });

    it('should prioritize annotation-based detection over text', async () => {
      const annotations: VisualAnnotation[] = [
        {
          type: 'circle',
          boundingBox: { x: 100, y: 200, width: 30, height: 30 },
          associatedText: 'A',
          confidence: 0.9,
          color: '#EF4444'
        }
      ];
      const extractedText = '選択: B'; // Text says B, but annotation says A

      const result = await visualAnnotationDetector.detectProductSelection(
        annotations,
        extractedText,
        mockShoppingContext
      );

      expect(result.success).toBe(true);
      expect(result.selectedProduct?.selectionMarker).toBe('A'); // Should use annotation
    });
  });

  describe('detectAmbiguousSelection', () => {
    it('should detect ambiguous selections', () => {
      const annotations: VisualAnnotation[] = [
        {
          type: 'circle',
          boundingBox: { x: 100, y: 200, width: 30, height: 30 },
          associatedText: 'A',
          confidence: 0.9,
          color: '#EF4444'
        },
        {
          type: 'circle',
          boundingBox: { x: 100, y: 300, width: 30, height: 30 },
          associatedText: 'B',
          confidence: 0.85,
          color: '#EF4444'
        }
      ];

      const isAmbiguous = visualAnnotationDetector.detectAmbiguousSelection(annotations);
      expect(isAmbiguous).toBe(true);
    });

    it('should not flag single selection as ambiguous', () => {
      const annotations: VisualAnnotation[] = [
        {
          type: 'circle',
          boundingBox: { x: 100, y: 200, width: 30, height: 30 },
          associatedText: 'A',
          confidence: 0.9,
          color: '#EF4444'
        }
      ];

      const isAmbiguous = visualAnnotationDetector.detectAmbiguousSelection(annotations);
      expect(isAmbiguous).toBe(false);
    });
  });

  describe('generateClarificationMessage', () => {
    it('should generate message for no selection', () => {
      const annotations: VisualAnnotation[] = [];
      const message = visualAnnotationDetector.generateClarificationMessage(
        annotations,
        'No selection text'
      );

      expect(message).toContain('could not detect');
      expect(message).toContain('circle one of the options');
    });

    it('should generate message for multiple selections', () => {
      const annotations: VisualAnnotation[] = [
        {
          type: 'circle',
          boundingBox: { x: 100, y: 200, width: 30, height: 30 },
          associatedText: 'A',
          confidence: 0.9,
          color: '#EF4444'
        },
        {
          type: 'circle',
          boundingBox: { x: 100, y: 300, width: 30, height: 30 },
          associatedText: 'C',
          confidence: 0.85,
          color: '#EF4444'
        }
      ];

      const message = visualAnnotationDetector.generateClarificationMessage(
        annotations,
        'Multiple circles'
      );

      expect(message).toContain('multiple selections');
      expect(message).toContain('A');
      expect(message).toContain('C');
    });
  });
});
