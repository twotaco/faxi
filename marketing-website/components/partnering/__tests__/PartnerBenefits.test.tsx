import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PartnerBenefits from '../PartnerBenefits';

describe('PartnerBenefits', () => {
  const renderComponent = () => {
    return render(<PartnerBenefits />);
  };

  it('renders data insights section', () => {
    renderComponent();
    
    // Check that emoji icons are rendered (indicating data insights are present)
    expect(screen.getByText('📊')).toBeInTheDocument();
    expect(screen.getByText('👥')).toBeInTheDocument();
    expect(screen.getByText('❤️')).toBeInTheDocument();
    expect(screen.getByText('⏰')).toBeInTheDocument();
  });

  it('displays market statistics with values', () => {
    renderComponent();
    
    // Check that market statistics values are displayed
    expect(screen.getByText('¥2.5T')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('29%')).toBeInTheDocument();
  });

  it('renders revenue opportunities section', () => {
    renderComponent();
    
    // Check that revenue opportunity icons are displayed
    expect(screen.getByText('💰')).toBeInTheDocument();
    expect(screen.getByText('📈')).toBeInTheDocument();
    expect(screen.getByText('🎯')).toBeInTheDocument();
  });

  it('displays partner testimonials', () => {
    renderComponent();
    
    // Check that testimonial quotes are rendered
    const quotes = screen.getAllByText(/"/);
    expect(quotes.length).toBeGreaterThan(0);
  });

  it('has proper structure', () => {
    const { container } = renderComponent();
    
    // Check that the component has the expected structure
    expect(container.querySelector('.bg-gradient-to-r')).toBeInTheDocument();
    expect(container.querySelectorAll('.bg-gray-50.rounded-lg').length).toBe(2);
  });
});
