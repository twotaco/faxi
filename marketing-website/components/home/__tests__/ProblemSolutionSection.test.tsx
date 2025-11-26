import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProblemSolutionSection } from '../ProblemSolutionSection';

describe('ProblemSolutionSection', () => {
  it('renders problem section with title and description', () => {
    render(<ProblemSolutionSection />);
    
    expect(screen.getByText('problem.title')).toBeInTheDocument();
    expect(screen.getByText('problem.description')).toBeInTheDocument();
  });

  it('renders all four statistics cards', () => {
    render(<ProblemSolutionSection />);
    
    expect(screen.getByText('problem.stats.faxUsers.label')).toBeInTheDocument();
    expect(screen.getByText('problem.stats.offlineSeniors.label')).toBeInTheDocument();
    expect(screen.getByText('problem.stats.elderlyPopulation.label')).toBeInTheDocument();
    expect(screen.getByText('problem.stats.noDigitalFootprint.label')).toBeInTheDocument();
  });

  it('renders statistics with sources', () => {
    render(<ProblemSolutionSection />);
    
    expect(screen.getByText('problem.stats.faxUsers.source')).toBeInTheDocument();
    expect(screen.getByText('problem.stats.offlineSeniors.source')).toBeInTheDocument();
  });

  it('renders solution section with title and description', () => {
    render(<ProblemSolutionSection />);
    
    expect(screen.getByText('solution.title')).toBeInTheDocument();
    expect(screen.getByText('solution.description')).toBeInTheDocument();
  });

  it('renders all four feature cards', () => {
    render(<ProblemSolutionSection />);
    
    expect(screen.getByText('solution.features.aiVision.title')).toBeInTheDocument();
    expect(screen.getByText('solution.features.instantProcessing.title')).toBeInTheDocument();
    expect(screen.getByText('solution.features.multiService.title')).toBeInTheDocument();
    expect(screen.getByText('solution.features.alwaysAvailable.title')).toBeInTheDocument();
  });

  it('renders feature descriptions', () => {
    render(<ProblemSolutionSection />);
    
    expect(screen.getByText('solution.features.aiVision.description')).toBeInTheDocument();
    expect(screen.getByText('solution.features.instantProcessing.description')).toBeInTheDocument();
  });
});
