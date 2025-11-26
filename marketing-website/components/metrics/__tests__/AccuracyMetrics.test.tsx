import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccuracyMetrics } from '../AccuracyMetrics';
import type { AccuracyMetrics as AccuracyMetricsType } from '@/lib/api/types';

describe('AccuracyMetrics', () => {
  const mockData: AccuracyMetricsType = {
    overall: 0.92,
    byCategory: {
      ocr: 0.94,
      annotationDetection: 0.89,
      intentClassification: 0.93,
    },
    byUseCase: [
      { useCase: 'Email', accuracy: 0.95, sampleCount: 50 },
      { useCase: 'Shopping', accuracy: 0.91, sampleCount: 45 },
      { useCase: 'AI Chat', accuracy: 0.90, sampleCount: 30 },
    ],
    trend: [
      { date: '2024-01-01', accuracy: 0.88 },
      { date: '2024-01-02', accuracy: 0.90 },
      { date: '2024-01-03', accuracy: 0.92 },
    ],
  };

  it('displays overall accuracy percentage', () => {
    render(<AccuracyMetrics data={mockData} />);
    expect(screen.getByText('92.0%')).toBeInTheDocument();
    expect(screen.getByText('Across all processing categories')).toBeInTheDocument();
  });

  it('displays accuracy breakdown by category', () => {
    render(<AccuracyMetrics data={mockData} />);
    expect(screen.getByText('94.0%')).toBeInTheDocument(); // OCR
    expect(screen.getByText('89.0%')).toBeInTheDocument(); // Annotation Detection
    expect(screen.getByText('93.0%')).toBeInTheDocument(); // Intent Classification
  });

  it('displays accuracy by use case with sample counts', () => {
    render(<AccuracyMetrics data={mockData} />);
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('95.0%')).toBeInTheDocument();
    expect(screen.getByText('(50 samples)')).toBeInTheDocument();
    
    expect(screen.getByText('Shopping')).toBeInTheDocument();
    expect(screen.getByText('91.0%')).toBeInTheDocument();
    expect(screen.getByText('(45 samples)')).toBeInTheDocument();
  });

  it('renders accuracy trend chart when trend data is available', () => {
    render(<AccuracyMetrics data={mockData} />);
    expect(screen.getByText('Accuracy Trend Over Time')).toBeInTheDocument();
  });

  it('does not render trend chart when trend data is empty', () => {
    const dataWithoutTrend = { ...mockData, trend: [] };
    render(<AccuracyMetrics data={dataWithoutTrend} />);
    expect(screen.queryByText('Accuracy Trend Over Time')).not.toBeInTheDocument();
  });
});
