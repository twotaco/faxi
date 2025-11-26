import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UseCaseSection } from '../UseCaseSection';

describe('UseCaseSection', () => {
  it('renders section title and subtitle', () => {
    render(<UseCaseSection locale="en" />);
    
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('subtitle')).toBeInTheDocument();
  });

  it('renders all four use case cards', () => {
    render(<UseCaseSection locale="en" />);
    
    expect(screen.getByText('healthcare.title')).toBeInTheDocument();
    expect(screen.getByText('shopping.title')).toBeInTheDocument();
    expect(screen.getByText('government.title')).toBeInTheDocument();
    expect(screen.getByText('aiChat.title')).toBeInTheDocument();
  });

  it('renders demographic information for each use case', () => {
    render(<UseCaseSection locale="en" />);
    
    expect(screen.getByText('healthcare.demographic')).toBeInTheDocument();
    expect(screen.getByText('shopping.demographic')).toBeInTheDocument();
    expect(screen.getByText('government.demographic')).toBeInTheDocument();
    expect(screen.getByText('aiChat.demographic')).toBeInTheDocument();
  });

  it('renders problem and solution for each use case', () => {
    render(<UseCaseSection locale="en" />);
    
    expect(screen.getByText('healthcare.problem')).toBeInTheDocument();
    expect(screen.getByText('healthcare.solution')).toBeInTheDocument();
    expect(screen.getByText('shopping.problem')).toBeInTheDocument();
    expect(screen.getByText('shopping.solution')).toBeInTheDocument();
  });

  it('renders view details links for all use cases', () => {
    render(<UseCaseSection locale="en" />);
    
    const viewDetailsLinks = screen.getAllByText('viewDetails →');
    expect(viewDetailsLinks).toHaveLength(4);
  });

  it('renders correct labels for Japanese locale', () => {
    render(<UseCaseSection locale="ja" />);
    
    const problemLabels = screen.getAllByText('課題:');
    const solutionLabels = screen.getAllByText('解決策:');
    
    expect(problemLabels).toHaveLength(4);
    expect(solutionLabels).toHaveLength(4);
  });

  it('renders correct labels for English locale', () => {
    render(<UseCaseSection locale="en" />);
    
    const problemLabels = screen.getAllByText('Problem:');
    const solutionLabels = screen.getAllByText('Solution:');
    
    expect(problemLabels).toHaveLength(4);
    expect(solutionLabels).toHaveLength(4);
  });
});
