import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CTABanner } from '../cta-banner';

describe('CTABanner', () => {
  it('renders default variant with title', () => {
    render(<CTABanner locale="en" audience="families" />);
    expect(screen.getByText(/get started with faxi/i)).toBeInTheDocument();
  });

  it('renders compact variant with title', () => {
    render(<CTABanner locale="en" audience="families" variant="compact" />);
    expect(screen.getByText(/get started with faxi/i)).toBeInTheDocument();
  });

  it('renders families CTAs with correct links', () => {
    render(<CTABanner locale="en" audience="families" />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(2);
    // Check that links are rendered
    expect(links[0]).toHaveAttribute('href');
    expect(links[1]).toHaveAttribute('href');
  });

  it('renders partners CTAs with correct links', () => {
    render(<CTABanner locale="en" audience="partners" />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(2);
    // Check that links are rendered
    expect(links[0]).toHaveAttribute('href');
    expect(links[1]).toHaveAttribute('href');
  });

  it('renders investors CTAs with external GitHub link', () => {
    render(<CTABanner locale="en" audience="investors" />);
    const links = screen.getAllByRole('link');
    // Find the GitHub link (should be external)
    const githubLink = links.find(link => 
      link.getAttribute('href')?.includes('github.com')
    );
    expect(githubLink).toBeDefined();
    expect(githubLink).toHaveAttribute('target', '_blank');
  });

  it('renders Japanese content when locale is ja', () => {
    render(<CTABanner locale="ja" audience="families" />);
    expect(screen.getByText(/faxiを始めましょう/i)).toBeInTheDocument();
  });

  it('renders different titles for different audiences', () => {
    const { rerender } = render(<CTABanner locale="en" audience="families" />);
    expect(screen.getByText(/get started with faxi/i)).toBeInTheDocument();

    rerender(<CTABanner locale="en" audience="partners" />);
    expect(screen.getByText(/partner with us/i)).toBeInTheDocument();

    rerender(<CTABanner locale="en" audience="investors" />);
    expect(screen.getByText(/explore the technology/i)).toBeInTheDocument();
  });
});
