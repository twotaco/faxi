import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PartnerValueProposition from '../PartnerValueProposition';

describe('PartnerValueProposition', () => {
  const renderComponent = () => {
    return render(<PartnerValueProposition />);
  };

  it('renders market opportunity section', () => {
    renderComponent();
    
    // Check that the component renders with market stats
    expect(screen.getByText('10M+')).toBeInTheDocument();
    expect(screen.getByText('36M')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('renders all partner types', () => {
    renderComponent();
    
    // Check that all 5 partner type cards are rendered
    const partnerCards = screen.getAllByRole('heading', { level: 4 });
    expect(partnerCards).toHaveLength(5);
  });

  it('displays benefits for each partner type', () => {
    renderComponent();
    
    // Check that benefit checkmarks are displayed
    const checkmarks = screen.getAllByText('✓');
    expect(checkmarks.length).toBeGreaterThan(0);
  });

  it('displays case study when available', () => {
    renderComponent();
    
    // Check that case study section exists
    expect(screen.getByText('caseStudy')).toBeInTheDocument();
  });

  it('renders with proper structure', () => {
    const { container } = renderComponent();
    
    // Check that the component has the expected structure
    expect(container.querySelector('.bg-gradient-to-b')).toBeInTheDocument();
    expect(container.querySelectorAll('.bg-white.rounded-lg').length).toBe(5);
  });
});
