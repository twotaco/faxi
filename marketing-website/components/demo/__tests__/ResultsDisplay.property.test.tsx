/**
 * **Feature: hackathon-winning-features, Property 7: Demo result display completeness**
 * 
 * Property: For any demo processing result displayed, it should show extracted text,
 * detected annotations, identified intent, confidence scores, and processing time
 * 
 * Validates: Requirements 5.3, 5.4
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResultsDisplay } from '../ResultsDisplay';
import type { ProcessingResult } from '@/lib/api/types';
import fc from 'fast-check';

// Arbitraries for generating test data
const boundingBoxArb = fc.record({
  x: fc.integer({ min: 0, max: 1000 }),
  y: fc.integer({ min: 0, max: 1000 }),
  width: fc.integer({ min: 10, max: 500 }),
  height: fc.integer({ min: 10, max: 500 }),
});

const hexColorArb = fc.integer({ min: 0, max: 0xFFFFFF }).map(n => 
  `#${n.toString(16).padStart(6, '0')}`
);

const annotationArb = fc.record({
  type: fc.constantFrom('checkmark', 'circle', 'arrow', 'underline'),
  boundingBox: boundingBoxArb,
  associatedText: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  confidence: fc.double({ min: 0, max: 1 }),
  color: fc.option(hexColorArb, { nil: undefined }),
});

const regionArb = fc.record({
  type: fc.constantFrom('text', 'annotation', 'form-field', 'signature'),
  boundingBox: boundingBoxArb,
  label: fc.string({ minLength: 1, maxLength: 30 }),
  confidence: fc.double({ min: 0, max: 1 }),
  color: fc.option(hexColorArb, { nil: undefined }),
});

const intentArb = fc.record({
  primary: fc.string({ minLength: 1, maxLength: 50 }),
  secondary: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 3 }), { nil: undefined }),
  parameters: fc.dictionary(fc.string(), fc.anything()),
  confidence: fc.double({ min: 0, max: 1 }),
});

const processingResultArb = fc.record({
  faxId: fc.uuid(),
  extractedText: fc.string({ minLength: 0, maxLength: 500 }),
  annotations: fc.array(annotationArb, { maxLength: 10 }),
  intent: intentArb,
  confidence: fc.double({ min: 0, max: 1 }),
  processingTime: fc.integer({ min: 100, max: 10000 }),
  visualizationData: fc.record({
    annotatedImageUrl: fc.option(fc.webUrl(), { nil: undefined }),
    regions: fc.array(regionArb, { maxLength: 15 }),
  }),
});

describe('ResultsDisplay Property Tests', () => {
  it('**Feature: hackathon-winning-features, Property 7: Demo result display completeness**', () => {
    fc.assert(
      fc.property(processingResultArb, (result: ProcessingResult) => {
        const { container, unmount } = render(<ResultsDisplay result={result} />);

        try {
          // Should display extracted text
          const extractedTextElements = screen.getAllByText(/Extracted Text/i);
          expect(extractedTextElements.length).toBeGreaterThan(0);
          if (result.extractedText) {
            expect(container.textContent).toContain(result.extractedText);
          }

          // Should display detected annotations
          if (result.annotations.length > 0) {
            const annotationElements = screen.getAllByText(/Visual Annotations/i);
            expect(annotationElements.length).toBeGreaterThan(0);
          }

          // Should display identified intent
          const intentElements = screen.getAllByText(/Identified Intent/i);
          expect(intentElements.length).toBeGreaterThan(0);
          const primaryIntentElements = screen.getAllByText(/Primary Intent/i);
          expect(primaryIntentElements.length).toBeGreaterThan(0);
          expect(container.textContent).toContain(result.intent.primary);

          // Should display confidence scores
          const confidenceElements = screen.getAllByText(/AI Confidence/i);
          expect(confidenceElements.length).toBeGreaterThan(0);
          const overallConfidenceElements = screen.getAllByText(/Overall Confidence/i);
          expect(overallConfidenceElements.length).toBeGreaterThan(0);
          const confidenceText = (result.confidence * 100).toFixed(1);
          expect(container.textContent).toContain(confidenceText);

          // Should display processing time
          const processingTimeElements = screen.getAllByText(/Processing Time/i);
          expect(processingTimeElements.length).toBeGreaterThan(0);
          const processingTimeText = (result.processingTime / 1000).toFixed(2);
          expect(container.textContent).toContain(processingTimeText);

          // Should display processing metrics summary
          const metricsElements = screen.getAllByText(/Processing Metrics/i);
          expect(metricsElements.length).toBeGreaterThan(0);
        } finally {
          unmount();
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should display all required elements for minimal result', () => {
    const minimalResult: ProcessingResult = {
      faxId: 'test-123',
      extractedText: '',
      annotations: [],
      intent: {
        primary: 'test-intent',
        parameters: {},
        confidence: 0.5,
      },
      confidence: 0.5,
      processingTime: 1000,
      visualizationData: {
        regions: [],
      },
    };

    render(<ResultsDisplay result={minimalResult} />);

    // All required sections should be present even with minimal data
    expect(screen.getByText(/Extracted Text/i)).toBeInTheDocument();
    expect(screen.getByText(/Identified Intent/i)).toBeInTheDocument();
    expect(screen.getByText(/AI Confidence/i)).toBeInTheDocument();
    expect(screen.getByText(/Processing Metrics/i)).toBeInTheDocument();
    expect(screen.getByText(/Processing Complete/i)).toBeInTheDocument();
  });
});
