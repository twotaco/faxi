import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import UseCasesSection from '../UseCasesSection';

describe('UseCasesSection', () => {
  it('should render the section', () => {
    const { container } = render(<UseCasesSection />);
    expect(container.querySelector('section')).toBeInTheDocument();
  });

  it('should render all five use case cards', () => {
    const { container } = render(<UseCasesSection />);
    
    // Check that we have 5 use case cards
    const cards = container.querySelectorAll('.bg-white.rounded-lg.shadow-lg');
    expect(cards.length).toBe(5);
  });

  it('should render use case cards with proper icons', () => {
    const { container } = render(<UseCasesSection />);
    
    // Check for emoji icons
    expect(container.textContent).toContain('🏥'); // Healthcare
    expect(container.textContent).toContain('🛒'); // Shopping
    expect(container.textContent).toContain('🏛️'); // Government
    expect(container.textContent).toContain('💳'); // Payment
    expect(container.textContent).toContain('💬'); // AI Chat
  });

  it('should have proper grid layout', () => {
    const { container } = render(<UseCasesSection />);
    
    // Check for grid container
    const gridContainer = container.querySelector('.grid.grid-cols-1.lg\\:grid-cols-2');
    expect(gridContainer).toBeInTheDocument();
  });
});
