import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeroSection } from '../HeroSection';

describe('HeroSection', () => {
  it('renders hero section with families content', () => {
    render(<HeroSection locale="en" />);
    
    // Check that the component renders
    expect(screen.getByText('headline')).toBeInTheDocument();
    expect(screen.getByText('subheadline')).toBeInTheDocument();
  });

  it('renders CTAs', () => {
    render(<HeroSection locale="en" />);
    
    expect(screen.getByText('ctaPrimary')).toBeInTheDocument();
    expect(screen.getByText('ctaSecondary')).toBeInTheDocument();
  });

  it('renders with Japanese locale', () => {
    render(<HeroSection locale="ja" />);
    
    expect(screen.getByText('headline')).toBeInTheDocument();
    expect(screen.getByText('subheadline')).toBeInTheDocument();
  });
});
