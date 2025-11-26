import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ServiceOverview from '../ServiceOverview';

describe('ServiceOverview', () => {
  it('should render the service overview section', () => {
    const { container } = render(<ServiceOverview />);
    expect(container.querySelector('section')).toBeInTheDocument();
  });

  it('should render all four steps with icons', () => {
    const { container } = render(<ServiceOverview />);
    
    // Check for step icons (FileText, Send, Cpu, CheckCircle)
    const icons = container.querySelectorAll('.lucide');
    expect(icons.length).toBeGreaterThanOrEqual(4);
    
    // Check for step structure
    const stepContainers = container.querySelectorAll('.relative.flex.flex-col.items-center.text-center');
    expect(stepContainers.length).toBe(4);
  });

  it('should render example fax formats section', () => {
    const { container } = render(<ServiceOverview />);
    
    // Check for example section
    const exampleSection = container.querySelector('.bg-white.rounded-lg.shadow-lg');
    expect(exampleSection).toBeInTheDocument();
    
    // Check for example cards
    expect(screen.getByText('Healthcare')).toBeInTheDocument();
    expect(screen.getByText('Shopping')).toBeInTheDocument();
    expect(screen.getByText('AI Chat')).toBeInTheDocument();
  });

  it('should have proper visual structure', () => {
    const { container } = render(<ServiceOverview />);
    
    // Check for colored icon backgrounds
    expect(container.querySelector('.bg-blue-100')).toBeInTheDocument();
    expect(container.querySelector('.bg-green-100')).toBeInTheDocument();
    expect(container.querySelector('.bg-purple-100')).toBeInTheDocument();
    expect(container.querySelector('.bg-orange-100')).toBeInTheDocument();
  });
});
