import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CTAButton } from '../cta-button';

describe('CTAButton', () => {
  it('renders button with children text', () => {
    render(<CTAButton>Click Me</CTAButton>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('renders as link when href is provided', () => {
    render(<CTAButton href="/test">Go to Test</CTAButton>);
    const link = screen.getByRole('link', { name: /go to test/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/test');
  });

  it('renders external link with correct attributes', () => {
    render(
      <CTAButton href="https://github.com/test" external>
        GitHub
      </CTAButton>
    );
    const link = screen.getByRole('link', { name: /github/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('applies primary styling for families audience', () => {
    render(
      <CTAButton audience="families" priority="primary">
        Primary CTA
      </CTAButton>
    );
    const button = screen.getByRole('button', { name: /primary cta/i });
    expect(button).toHaveClass('bg-blue-600');
  });

  it('applies primary styling for partners audience', () => {
    render(
      <CTAButton audience="partners" priority="primary">
        Partner CTA
      </CTAButton>
    );
    const button = screen.getByRole('button', { name: /partner cta/i });
    expect(button).toHaveClass('bg-green-600');
  });

  it('applies primary styling for investors audience', () => {
    render(
      <CTAButton audience="investors" priority="primary">
        Investor CTA
      </CTAButton>
    );
    const button = screen.getByRole('button', { name: /investor cta/i });
    expect(button).toHaveClass('bg-purple-600');
  });

  it('applies secondary styling when priority is secondary', () => {
    render(
      <CTAButton audience="families" priority="secondary">
        Secondary CTA
      </CTAButton>
    );
    const button = screen.getByRole('button', { name: /secondary cta/i });
    expect(button).toHaveClass('border-blue-600');
  });

  it('applies large size by default', () => {
    render(<CTAButton>Large Button</CTAButton>);
    const button = screen.getByRole('button', { name: /large button/i });
    expect(button).toHaveClass('h-10');
  });

  it('applies custom className', () => {
    render(<CTAButton className="custom-class">Custom</CTAButton>);
    const button = screen.getByRole('button', { name: /custom/i });
    expect(button).toHaveClass('custom-class');
  });
});
