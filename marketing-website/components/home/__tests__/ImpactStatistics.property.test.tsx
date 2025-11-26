/**
 * **Feature: hackathon-winning-features, Property 11: Statistics source attribution**
 * **Validates: Requirements 6.4**
 * 
 * Property: For any statistic displayed in the impact section, it should 
 * include a source citation or reference link.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { ImpactStatistics } from '../ImpactStatistics';

// Mock useTranslations to return actual translation keys
vi.mock('next-intl', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  useTranslations: (_namespace: string) => (key: string) => {
    const translations: Record<string, string> = {
      'title': 'Our Impact',
      'subtitle': 'Bridging the digital divide',
      'stats.faxUsers.value': '10M+',
      'stats.faxUsers.label': 'Active Fax Users',
      'stats.faxUsers.description': 'Millions rely on fax',
      'stats.faxUsers.source': 'Ministry of Internal Affairs',
      'stats.offlineSeniors.value': '25%',
      'stats.offlineSeniors.label': 'Seniors Without Internet',
      'stats.offlineSeniors.description': 'Digital divide exists',
      'stats.offlineSeniors.source': 'Ministry of Internal Affairs',
      'stats.elderlyPopulation.value': '36M',
      'stats.elderlyPopulation.label': 'Elderly Population',
      'stats.elderlyPopulation.description': 'Large elderly population',
      'stats.elderlyPopulation.source': 'Statistics Bureau of Japan',
      'stats.aiAccuracy.value': '90%+',
      'stats.aiAccuracy.label': 'AI Accuracy',
      'stats.aiAccuracy.description': 'High accuracy AI',
      'stats.aiAccuracy.source': 'Faxi Internal Testing',
      'stats.processingTime.value': '<5s',
      'stats.processingTime.label': 'Processing Time',
      'stats.processingTime.description': 'Fast processing',
      'stats.processingTime.source': 'Faxi Performance Metrics',
      'stats.useCases.value': '10+',
      'stats.useCases.label': 'Use Cases',
      'stats.useCases.description': 'Diverse services',
      'stats.useCases.source': 'Faxi Service Catalog'
    };
    
    return translations[key] || key;
  }
}));

describe('ImpactStatistics - Property-Based Tests', () => {
  afterEach(() => {
    cleanup();
  });

  it('**Feature: hackathon-winning-features, Property 11: Statistics source attribution**', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary test runs to ensure consistency
        fc.integer({ min: 1, max: 100 }),
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (_testRun) => {
          // Render the component
          const { container } = render(<ImpactStatistics />);

          // Get all statistic cards
          const statCards = container.querySelectorAll('[class*="bg-gradient-to-br"]');
          
          // Property: Each statistic must have a source citation
          expect(statCards.length).toBeGreaterThan(0);
          
          statCards.forEach((card) => {
            // Check for source text
            const sourceElements = card.querySelectorAll('[class*="italic"]');
            expect(sourceElements.length).toBeGreaterThan(0);
            
            // Verify source contains "Source:" prefix
            let hasSourcePrefix = false;
            sourceElements.forEach((element) => {
              if (element.textContent?.includes('Source:')) {
                hasSourcePrefix = true;
              }
            });
            expect(hasSourcePrefix).toBe(true);
            
            // Verify source is not empty (has actual citation)
            let hasNonEmptySource = false;
            sourceElements.forEach((element) => {
              const sourceText = element.textContent?.replace('Source:', '').trim();
              if (sourceText && sourceText.length > 0) {
                hasNonEmptySource = true;
              }
            });
            expect(hasNonEmptySource).toBe(true);
          });
          
          // Clean up after each property test run
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should display all statistics with sources', () => {
    const { container } = render(<ImpactStatistics />);
    
    // Check that we have 6 statistics (as defined in the component)
    const statCards = container.querySelectorAll('[class*="bg-gradient-to-br"]');
    expect(statCards.length).toBe(6);
    
    // Each card should have a source
    statCards.forEach((card) => {
      const sourceText = card.textContent;
      expect(sourceText).toContain('Source:');
      
      // Verify specific sources are present
      const hasValidSource = 
        sourceText?.includes('Ministry') ||
        sourceText?.includes('Statistics Bureau') ||
        sourceText?.includes('Faxi');
      expect(hasValidSource).toBe(true);
    });
  });

  it('should have non-empty source citations for all statistics', () => {
    const { container } = render(<ImpactStatistics />);
    
    const statCards = container.querySelectorAll('[class*="bg-gradient-to-br"]');
    
    statCards.forEach((card) => {
      // Find the source element (should be italic and have border-t)
      const sourceElement = card.querySelector('[class*="italic"][class*="border-t"]');
      expect(sourceElement).toBeTruthy();
      
      const sourceText = sourceElement?.textContent || '';
      
      // Source should have "Source:" prefix
      expect(sourceText).toContain('Source:');
      
      // Source should have actual content after "Source:"
      const sourceContent = sourceText.split('Source:')[1]?.trim();
      expect(sourceContent).toBeTruthy();
      expect(sourceContent!.length).toBeGreaterThan(0);
    });
  });
});
