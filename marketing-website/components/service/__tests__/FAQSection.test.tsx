import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import FAQSection from '../FAQSection';

describe('FAQSection', () => {
  it('should render the FAQ section', () => {
    const { container } = render(<FAQSection />);
    expect(container.querySelector('section')).toBeInTheDocument();
  });

  it('should render all FAQ items', () => {
    const { container } = render(<FAQSection />);
    
    // Check for accordion buttons
    const buttons = container.querySelectorAll('button[aria-expanded]');
    expect(buttons.length).toBe(6); // 6 FAQ items
  });

  it('should toggle FAQ answers when clicked', () => {
    const { container } = render(<FAQSection />);
    
    // Find the first FAQ button
    const buttons = container.querySelectorAll('button[aria-expanded]');
    const firstButton = buttons[0];
    
    // Initially, aria-expanded should be false
    expect(firstButton.getAttribute('aria-expanded')).toBe('false');
    
    // Click to expand
    fireEvent.click(firstButton);
    expect(firstButton.getAttribute('aria-expanded')).toBe('true');
    
    // Click again to collapse
    fireEvent.click(firstButton);
    expect(firstButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('should render contact information section', () => {
    const { container } = render(<FAQSection />);
    
    // Check for contact section with blue background
    const contactSection = container.querySelector('.bg-blue-50');
    expect(contactSection).toBeInTheDocument();
    
    // Check for phone and fax icons
    const icons = contactSection?.querySelectorAll('.lucide');
    expect(icons?.length).toBeGreaterThanOrEqual(2);
  });

  it('should have proper accordion structure with chevron icons', () => {
    const { container } = render(<FAQSection />);
    
    // Check for chevron icons in buttons
    const chevrons = container.querySelectorAll('.lucide-chevron-down, .lucide-chevron-up');
    expect(chevrons.length).toBeGreaterThanOrEqual(6);
  });
});
