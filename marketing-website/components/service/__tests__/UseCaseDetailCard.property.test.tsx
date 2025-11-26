/**
 * **Feature: hackathon-winning-features, Property 6: Use case completeness**
 * **Validates: Requirements 4.2, 4.3, 4.5**
 * 
 * Property: For any use case displayed on the website, it should include 
 * before/after images, target demographic, problem description, and lazy 
 * loading attributes on images.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import UseCaseDetailCard from '../UseCaseDetailCard';

// Mock useTranslations to return actual translation keys
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      'service.useCases.healthcare': {
        title: 'Healthcare Access',
        demographic: 'Elderly patients',
        problem: 'Difficulty booking appointments',
        solution: 'Send a fax to book appointments',
        beforeLabel: 'Before: Complex form',
        afterLabel: 'After: Simple fax',
        technicalTitle: 'How it works',
        'technicalDetails.accuracy': '95% accuracy',
        'technicalDetails.processingTime': 'Average 4 seconds',
        'technicalDetails.intents.0': 'Book',
        'technicalDetails.intents.1': 'Cancel',
        'technicalDetails.intents.2': 'Reschedule',
        'technicalDetails.intents.3': 'Check'
      },
      'service.useCases.shopping': {
        title: 'Online Shopping',
        demographic: 'Seniors without internet',
        problem: 'Cannot access e-commerce',
        solution: 'Browse and order via fax',
        beforeLabel: 'Before: E-commerce site',
        afterLabel: 'After: Product selection',
        technicalTitle: 'How it works',
        'technicalDetails.accuracy': '92% accuracy',
        'technicalDetails.processingTime': 'Average 5 seconds',
        'technicalDetails.intents.0': 'Browse',
        'technicalDetails.intents.1': 'Add to cart',
        'technicalDetails.intents.2': 'Order',
        'technicalDetails.intents.3': 'Check status'
      },
      'service.useCases.government': {
        title: 'Government Services',
        demographic: 'Rural residents',
        problem: 'Limited access to services',
        solution: 'Submit forms via fax',
        beforeLabel: 'Before: Government portal',
        afterLabel: 'After: Form submission',
        technicalTitle: 'How it works',
        'technicalDetails.accuracy': '94% accuracy',
        'technicalDetails.processingTime': 'Average 6 seconds',
        'technicalDetails.intents.0': 'Submit',
        'technicalDetails.intents.1': 'Request',
        'technicalDetails.intents.2': 'Check',
        'technicalDetails.intents.3': 'Update'
      },
      'service.useCases.payment': {
        title: 'Bill Payments',
        demographic: 'Seniors managing finances',
        problem: 'Online banking is confusing',
        solution: 'Pay bills via fax',
        beforeLabel: 'Before: Banking interface',
        afterLabel: 'After: Payment form',
        technicalTitle: 'How it works',
        'technicalDetails.accuracy': '96% accuracy',
        'technicalDetails.processingTime': 'Average 3 seconds',
        'technicalDetails.intents.0': 'Pay',
        'technicalDetails.intents.1': 'Check balance',
        'technicalDetails.intents.2': 'History',
        'technicalDetails.intents.3': 'Auto-pay'
      },
      'service.useCases.aiChat': {
        title: 'AI Assistant',
        demographic: 'Isolated seniors',
        problem: 'Need information and help',
        solution: 'Chat with AI via fax',
        beforeLabel: 'Before: No access',
        afterLabel: 'After: AI answers',
        technicalTitle: 'How it works',
        'technicalDetails.accuracy': '91% accuracy',
        'technicalDetails.processingTime': 'Average 7 seconds',
        'technicalDetails.intents.0': 'Ask',
        'technicalDetails.intents.1': 'Get info',
        'technicalDetails.intents.2': 'Advice',
        'technicalDetails.intents.3': 'Chat'
      }
    };
    
    return translations[namespace]?.[key] || key;
  }
}));

describe('UseCaseDetailCard - Property-Based Tests', () => {
  afterEach(() => {
    cleanup();
  });

  it('**Feature: hackathon-winning-features, Property 6: Use case completeness**', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary use case keys and icons
        fc.constantFrom('healthcare', 'shopping', 'government', 'payment', 'aiChat'),
        fc.constantFrom('🏥', '🛒', '🏛️', '💳', '💬'),
        (useCaseKey, icon) => {
          // Render the component
          const { container } = render(
            <UseCaseDetailCard useCaseKey={useCaseKey} icon={icon} />
          );

          // Property 1: Should have target demographic displayed
          const demographics = screen.queryAllByText(/patients|internet|residents|finances|seniors/i);
          expect(demographics.length).toBeGreaterThan(0);

          // Property 2: Should have problem description
          const problems = screen.queryAllByText(/difficulty|cannot|limited|confusing|need/i);
          expect(problems.length).toBeGreaterThan(0);

          // Property 3: Should have before/after labels
          const beforeLabels = screen.queryAllByText(/Before:/);
          const afterLabels = screen.queryAllByText(/After:/);
          expect(beforeLabels.length).toBeGreaterThan(0);
          expect(afterLabels.length).toBeGreaterThan(0);

          // Property 4: Should have images with lazy loading
          const images = container.querySelectorAll('img');
          expect(images.length).toBeGreaterThanOrEqual(2); // At least before and after images
          
          images.forEach((img) => {
            // Check for lazy loading attribute
            expect(img.getAttribute('loading')).toBe('lazy');
            
            // Check for alt text (accessibility)
            expect(img.getAttribute('alt')).toBeTruthy();
            expect(img.getAttribute('alt')).not.toBe('');
          });

          // Property 5: Should have solution description
          const solutions = screen.queryAllByText(/Send a fax|Browse|Submit|Pay|Chat/i);
          expect(solutions.length).toBeGreaterThan(0);
          
          // Clean up after each property test run
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have all required elements for each use case', () => {
    const useCases = ['healthcare', 'shopping', 'government', 'payment', 'aiChat'];
    
    useCases.forEach((useCaseKey) => {
      const { container } = render(
        <UseCaseDetailCard useCaseKey={useCaseKey} icon="🏥" />
      );

      // Check for required structural elements
      const images = container.querySelectorAll('img');
      expect(images.length).toBeGreaterThanOrEqual(2);
      
      // All images should have lazy loading
      images.forEach((img) => {
        expect(img.getAttribute('loading')).toBe('lazy');
      });
    });
  });
});
