import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProcessingStatistics } from '../ProcessingStatistics';
import type { ProcessingStats } from '@/lib/api/types';

describe('ProcessingStatistics', () => {
  const mockData: ProcessingStats = {
    averageTime: 4.5,
    medianTime: 4.2,
    p95Time: 6.8,
    successRate: 0.96,
    totalProcessed: 1250,
    confidenceDistribution: [
      { range: '90-100%', count: 800, percentage: 64 },
      { range: '80-90%', count: 300, percentage: 24 },
      { range: '70-80%', count: 100, percentage: 8 },
      { range: '60-70%', count: 50, percentage: 4 },
    ],
    byUseCase: [
      { useCase: 'Email', avgTime: 4.2, successRate: 0.97 },
      { useCase: 'Shopping', avgTime: 5.1, successRate: 0.95 },
    ],
  };

  it('displays average processing time', () => {
    render(<ProcessingStatistics data={mockData} />);
    expect(screen.getByText('4.50s')).toBeInTheDocument();
    expect(screen.getByText('Median: 4.20s')).toBeInTheDocument();
  });

  it('displays success rate percentage', () => {
    render(<ProcessingStatistics data={mockData} />);
    expect(screen.getByText('96.0%')).toBeInTheDocument();
  });

  it('displays total faxes processed', () => {
    render(<ProcessingStatistics data={mockData} />);
    expect(screen.getByText('1,250')).toBeInTheDocument();
  });

  it('displays 95th percentile time when available', () => {
    render(<ProcessingStatistics data={mockData} />);
    expect(screen.getByText('6.80s')).toBeInTheDocument();
    expect(screen.getByText('95% complete within this time')).toBeInTheDocument();
  });

  it('displays confidence distribution data', () => {
    render(<ProcessingStatistics data={mockData} />);
    expect(screen.getByText('Confidence Score Distribution')).toBeInTheDocument();
    expect(screen.getByText(/90-100%/)).toBeInTheDocument();
    // Check that the confidence ranges are displayed
    expect(screen.getByText(/80-90%/)).toBeInTheDocument();
    expect(screen.getByText(/70-80%/)).toBeInTheDocument();
  });

  it('displays statistics by use case when available', () => {
    render(<ProcessingStatistics data={mockData} />);
    expect(screen.getByText('Statistics by Use Case')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('4.20s')).toBeInTheDocument();
    expect(screen.getByText('97.0%')).toBeInTheDocument();
  });

  it('does not display by use case section when data is not available', () => {
    const dataWithoutUseCase = { ...mockData, byUseCase: undefined };
    render(<ProcessingStatistics data={dataWithoutUseCase} />);
    expect(screen.queryByText('Statistics by Use Case')).not.toBeInTheDocument();
  });
});
