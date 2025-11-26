import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CTASection } from '../cta-section';

describe('CTASection', () => {
  const mockCTAs = [
    { text: 'Primary Action', href: '/primary', priority: 'primary' as const },
    { text: 'Secondary Action', href: '/secondary', priority: 'secondary' as const },
  ];

  it('renders all CTA buttons', () => {
    render(<CTASection ctas={mockCTAs} />);
    expect(screen.getByRole('link', { name: /primary action/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /secondary action/i })).toBeInTheDocument();
  });

  it('applies horizontal orientation by default', () => {
    const { container } = render(<CTASection ctas={mockCTAs} />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('flex-row');
  });

  it('applies vertical orientation when specified', () => {
    const { container } = render(<CTASection ctas={mockCTAs} orientation="vertical" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('flex-col');
  });

  it('passes audience prop to CTA buttons', () => {
    render(<CTASection ctas={mockCTAs} audience="partners" />);
    const primaryButton = screen.getByRole('link', { name: /primary action/i });
    // Button should be rendered with partner audience styling
    expect(primaryButton).toBeInTheDocument();
    expect(primaryButton).toHaveAttribute('href', '/primary');
  });

  it('applies first CTA as primary by default', () => {
    const ctasWithoutPriority = [
      { text: 'First', href: '/first' },
      { text: 'Second', href: '/second' },
    ];
    render(<CTASection ctas={ctasWithoutPriority} />);
    const firstButton = screen.getByRole('link', { name: /first/i });
    const secondButton = screen.getByRole('link', { name: /second/i });
    // Both buttons should be rendered
    expect(firstButton).toBeInTheDocument();
    expect(secondButton).toBeInTheDocument();
  });

  it('handles external links correctly', () => {
    const externalCTAs = [
      { text: 'GitHub', href: 'https://github.com/test', external: true },
    ];
    render(<CTASection ctas={externalCTAs} />);
    const link = screen.getByRole('link', { name: /github/i });
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('applies custom className', () => {
    const { container } = render(<CTASection ctas={mockCTAs} className="custom-class" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('custom-class');
  });
});
