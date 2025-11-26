import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeroSection } from '../HeroSection';

describe('HeroSection', () => {
  it('renders hero section with default audience (families)', () => {
    render(<HeroSection locale="en" />);
    
    // Check that the component renders
    expect(screen.getByText('families.headline')).toBeInTheDocument();
    expect(screen.getByText('families.subheadline')).toBeInTheDocument();
  });

  it('renders audience selector buttons', () => {
    render(<HeroSection locale="en" />);
    
    expect(screen.getByText('For Families')).toBeInTheDocument();
    expect(screen.getByText('For Partners')).toBeInTheDocument();
    expect(screen.getByText('For Investors')).toBeInTheDocument();
  });

  it('switches audience when button is clicked', () => {
    render(<HeroSection locale="en" />);
    
    const partnersButton = screen.getByText('For Partners');
    fireEvent.click(partnersButton);
    
    expect(screen.getByText('partners.headline')).toBeInTheDocument();
    expect(screen.getByText('partners.subheadline')).toBeInTheDocument();
  });

  it('renders CTAs for the selected audience', () => {
    render(<HeroSection locale="en" />);
    
    expect(screen.getByText('families.ctaPrimary')).toBeInTheDocument();
    expect(screen.getByText('families.ctaSecondary')).toBeInTheDocument();
  });

  it('renders Japanese text when locale is ja', () => {
    render(<HeroSection locale="ja" />);
    
    expect(screen.getByText('家族向け')).toBeInTheDocument();
    expect(screen.getByText('パートナー向け')).toBeInTheDocument();
    expect(screen.getByText('投資家向け')).toBeInTheDocument();
  });

  it('changes content when switching to investors audience', () => {
    render(<HeroSection locale="en" />);
    
    const investorsButton = screen.getByText('For Investors');
    fireEvent.click(investorsButton);
    
    expect(screen.getByText('investors.headline')).toBeInTheDocument();
    expect(screen.getByText('investors.subheadline')).toBeInTheDocument();
  });
});
