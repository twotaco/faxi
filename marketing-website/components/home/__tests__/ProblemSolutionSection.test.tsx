import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProblemSolutionSection } from '../ProblemSolutionSection';

describe('ProblemSolutionSection', () => {
  it('renders problem section with title and description', () => {
    render(<ProblemSolutionSection />);
    
    expect(screen.getByText('problem.title')).toBeInTheDocument();
    expect(screen.getByText('problem.description')).toBeInTheDocument();
  });

  it('renders all four pain point cards', () => {
    render(<ProblemSolutionSection />);
    
    expect(screen.getByText('problem.painPoints.complexity.title')).toBeInTheDocument();
    expect(screen.getByText('problem.painPoints.isolation.title')).toBeInTheDocument();
    expect(screen.getByText('problem.painPoints.independence.title')).toBeInTheDocument();
    expect(screen.getByText('problem.painPoints.trust.title')).toBeInTheDocument();
  });

  it('renders pain point descriptions', () => {
    render(<ProblemSolutionSection />);
    
    expect(screen.getByText('problem.painPoints.complexity.description')).toBeInTheDocument();
    expect(screen.getByText('problem.painPoints.isolation.description')).toBeInTheDocument();
  });

  it('renders solution section with title and description', () => {
    render(<ProblemSolutionSection />);
    
    expect(screen.getByText('solution.title')).toBeInTheDocument();
    expect(screen.getByText('solution.description')).toBeInTheDocument();
  });

  it('renders all four feature cards', () => {
    render(<ProblemSolutionSection />);
    
    expect(screen.getByText('solution.features.noLearning.title')).toBeInTheDocument();
    expect(screen.getByText('solution.features.instantResponse.title')).toBeInTheDocument();
    expect(screen.getByText('solution.features.multiService.title')).toBeInTheDocument();
    expect(screen.getByText('solution.features.alwaysWorking.title')).toBeInTheDocument();
  });

  it('renders feature descriptions', () => {
    render(<ProblemSolutionSection />);
    
    expect(screen.getByText('solution.features.noLearning.description')).toBeInTheDocument();
    expect(screen.getByText('solution.features.instantResponse.description')).toBeInTheDocument();
  });
});
