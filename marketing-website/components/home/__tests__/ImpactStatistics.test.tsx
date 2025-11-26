import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImpactStatistics } from '../ImpactStatistics';

// Mock useTranslations
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

describe('ImpactStatistics', () => {
  it('should render the title and subtitle', () => {
    render(<ImpactStatistics />);
    
    expect(screen.getByText('Our Impact')).toBeTruthy();
    expect(screen.getByText('Bridging the digital divide')).toBeTruthy();
  });

  it('should display all six statistics', () => {
    const { container } = render(<ImpactStatistics />);
    
    // Check for statistic cards (values start at 0 due to animation)
    const statCards = container.querySelectorAll('[class*="bg-gradient-to-br"]');
    expect(statCards.length).toBe(6);
    
    // Check that each card has a value displayed (even if it's "0" initially)
    const valueElements = container.querySelectorAll('[class*="text-5xl"]');
    expect(valueElements.length).toBe(6);
    
    // Each value element should have content
    valueElements.forEach((element) => {
      expect(element.textContent).toBeTruthy();
    });
  });

  it('should display source citations for all statistics', () => {
    render(<ImpactStatistics />);
    
    // Check for source text
    const sourceElements = screen.getAllByText(/Source:/);
    expect(sourceElements.length).toBe(6);
    
    // Check for specific sources
    expect(screen.getAllByText(/Ministry of Internal Affairs/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Statistics Bureau of Japan/)).toBeTruthy();
    expect(screen.getByText(/Faxi Internal Testing/)).toBeTruthy();
    expect(screen.getByText(/Faxi Performance Metrics/)).toBeTruthy();
    expect(screen.getByText(/Faxi Service Catalog/)).toBeTruthy();
  });

  it('should display labels for all statistics', () => {
    render(<ImpactStatistics />);
    
    expect(screen.getByText('Active Fax Users')).toBeTruthy();
    expect(screen.getByText('Seniors Without Internet')).toBeTruthy();
    expect(screen.getByText('Elderly Population')).toBeTruthy();
    expect(screen.getByText('AI Accuracy')).toBeTruthy();
    expect(screen.getByText('Processing Time')).toBeTruthy();
    expect(screen.getByText('Use Cases')).toBeTruthy();
  });

  it('should display descriptions for all statistics', () => {
    render(<ImpactStatistics />);
    
    expect(screen.getByText('Millions rely on fax')).toBeTruthy();
    expect(screen.getByText('Digital divide exists')).toBeTruthy();
    expect(screen.getByText('Large elderly population')).toBeTruthy();
    expect(screen.getByText('High accuracy AI')).toBeTruthy();
    expect(screen.getByText('Fast processing')).toBeTruthy();
    expect(screen.getByText('Diverse services')).toBeTruthy();
  });

  it('should have proper styling for statistics cards', () => {
    const { container } = render(<ImpactStatistics />);
    
    const statCards = container.querySelectorAll('[class*="bg-gradient-to-br"]');
    
    statCards.forEach((card) => {
      // Check for gradient background
      expect(card.className).toContain('bg-gradient-to-br');
      
      // Check for rounded corners
      expect(card.className).toContain('rounded');
      
      // Check for shadow
      expect(card.className).toContain('shadow');
    });
  });

  it('should have accessible structure', () => {
    const { container } = render(<ImpactStatistics />);
    
    // Check for section element
    const section = container.querySelector('section');
    expect(section).toBeTruthy();
    
    // Check for heading
    const heading = container.querySelector('h2');
    expect(heading).toBeTruthy();
    expect(heading?.textContent).toBe('Our Impact');
  });
});
