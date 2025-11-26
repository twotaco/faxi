import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestimonialsSection } from '../TestimonialsSection';

describe('TestimonialsSection', () => {
  it('renders section title and subtitle', () => {
    render(<TestimonialsSection />);
    
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('subtitle')).toBeInTheDocument();
  });

  it('renders all three testimonial cards', () => {
    render(<TestimonialsSection />);
    
    expect(screen.getByText('items.tanaka.quote')).toBeInTheDocument();
    expect(screen.getByText('items.clinic.quote')).toBeInTheDocument();
    expect(screen.getByText('items.family.quote')).toBeInTheDocument();
  });

  it('renders author information for each testimonial', () => {
    render(<TestimonialsSection />);
    
    expect(screen.getByText('items.tanaka.author')).toBeInTheDocument();
    expect(screen.getByText('items.clinic.author')).toBeInTheDocument();
    expect(screen.getByText('items.family.author')).toBeInTheDocument();
  });

  it('renders role information for each testimonial', () => {
    render(<TestimonialsSection />);
    
    expect(screen.getByText('items.tanaka.role')).toBeInTheDocument();
    expect(screen.getByText('items.clinic.role')).toBeInTheDocument();
    expect(screen.getByText('items.family.role')).toBeInTheDocument();
  });

  it('renders demographic information for each testimonial', () => {
    render(<TestimonialsSection />);
    
    expect(screen.getByText('items.tanaka.demographic')).toBeInTheDocument();
    expect(screen.getByText('items.clinic.demographic')).toBeInTheDocument();
    expect(screen.getByText('items.family.demographic')).toBeInTheDocument();
  });

  it('renders quote marks for visual styling', () => {
    const { container } = render(<TestimonialsSection />);
    
    const quoteMarks = container.querySelectorAll('.text-4xl');
    expect(quoteMarks.length).toBeGreaterThanOrEqual(3);
  });
});
