/**
 * Integration tests for the demo flow
 * Tests fixture selection, file upload, processing, error handling, and result display
 * 
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { FixtureSelection } from '../FixtureSelection';
import { FileUpload } from '../FileUpload';
import { ProcessingStatus } from '../ProcessingStatus';
import { ResultsDisplay } from '../ResultsDisplay';
import type { DemoFixture, ProcessingResult } from '@/lib/api/types';

// Mock fixtures
const mockFixtures: DemoFixture[] = [
  {
    id: 'fixture-1',
    name: 'Email Request',
    description: 'Sample email fax',
    category: 'email',
    thumbnailUrl: '/test-thumb-1.jpg',
    imageUrl: '/test-img-1.jpg',
  },
  {
    id: 'fixture-2',
    name: 'Shopping Order',
    description: 'Sample shopping fax',
    category: 'shopping',
    thumbnailUrl: '/test-thumb-2.jpg',
    imageUrl: '/test-img-2.jpg',
  },
  {
    id: 'fixture-3',
    name: 'AI Chat',
    description: 'Sample AI chat fax',
    category: 'ai-chat',
    thumbnailUrl: '/test-thumb-3.jpg',
    imageUrl: '/test-img-3.jpg',
  },
  {
    id: 'fixture-4',
    name: 'Payment',
    description: 'Sample payment fax',
    category: 'payment',
    thumbnailUrl: '/test-thumb-4.jpg',
    imageUrl: '/test-img-4.jpg',
  },
];

// Mock processing result
const mockResult: ProcessingResult = {
  faxId: 'test-fax-123',
  extractedText: 'Test extracted text from fax',
  annotations: [
    {
      type: 'checkmark',
      boundingBox: { x: 10, y: 20, width: 30, height: 40 },
      confidence: 0.95,
      color: '#00ff00',
    },
  ],
  intent: {
    primary: 'send_email',
    parameters: { recipient: 'test@example.com' },
    confidence: 0.92,
  },
  confidence: 0.93,
  processingTime: 2500,
  visualizationData: {
    annotatedImageUrl: '/test-annotated.jpg',
    regions: [
      {
        type: 'text',
        boundingBox: { x: 0, y: 0, width: 100, height: 50 },
        label: 'Text Region',
        confidence: 0.9,
      },
    ],
  },
};

describe('Demo Flow Integration Tests', () => {
  describe('Fixture Selection', () => {
    it('should display at least 6 fixtures grouped by category', () => {
      const onSelect = vi.fn();
      const { container } = render(
        <FixtureSelection
          fixtures={mockFixtures}
          selectedFixture={null}
          onSelect={onSelect}
        />
      );

      // Should show header
      expect(screen.getByText(/Select a Sample Fax/i)).toBeInTheDocument();

      // Should display all fixtures
      expect(container.textContent).toContain('Email Request');
      expect(container.textContent).toContain('Shopping Order');
      expect(container.textContent).toContain('AI Chat');
      expect(container.textContent).toContain('Payment');

      // Should group by category
      expect(screen.getAllByText(/Email/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Shopping/i).length).toBeGreaterThan(0);
    });

    it('should allow selecting a fixture', () => {
      const onSelect = vi.fn();
      render(
        <FixtureSelection
          fixtures={mockFixtures}
          selectedFixture={null}
          onSelect={onSelect}
        />
      );

      // Click on a fixture
      const fixtureCard = screen.getByText('Email Request').closest('div[class*="cursor-pointer"]');
      expect(fixtureCard).toBeInTheDocument();
      fireEvent.click(fixtureCard!);

      // Should call onSelect
      expect(onSelect).toHaveBeenCalledWith(mockFixtures[0]);
    });

    it('should highlight selected fixture', () => {
      const onSelect = vi.fn();
      const { rerender } = render(
        <FixtureSelection
          fixtures={mockFixtures}
          selectedFixture={null}
          onSelect={onSelect}
        />
      );

      // Initially no selection
      let fixtureCard = screen.getByText('Email Request').closest('div[class*="cursor-pointer"]');
      expect(fixtureCard?.className).not.toContain('ring-2');

      // Rerender with selection
      rerender(
        <FixtureSelection
          fixtures={mockFixtures}
          selectedFixture={mockFixtures[0]}
          onSelect={onSelect}
        />
      );

      fixtureCard = screen.getByText('Email Request').closest('div[class*="cursor-pointer"]');
      expect(fixtureCard?.className).toContain('ring-2');
    });
  });

  describe('File Upload', () => {
    it('should display upload interface with disclaimers', () => {
      const onFileSelect = vi.fn();
      render(<FileUpload onFileSelect={onFileSelect} />);

      // Should show upload area
      expect(screen.getByText(/Upload Your Own Fax/i)).toBeInTheDocument();
      expect(screen.getByText(/Drag and drop/i)).toBeInTheDocument();

      // Should show disclaimer
      expect(screen.getByText(/Disclaimer/i)).toBeInTheDocument();
      expect(screen.getByText(/not stored permanently/i)).toBeInTheDocument();
    });

    it('should validate file types', async () => {
      const onFileSelect = vi.fn();
      render(<FileUpload onFileSelect={onFileSelect} />);

      // Create invalid file
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      const input = screen.getByLabelText(/Browse Files/i).closest('input');

      // Simulate file selection
      Object.defineProperty(input, 'files', {
        value: [invalidFile],
        writable: false,
      });
      fireEvent.change(input!);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
      });

      // Should not call onFileSelect
      expect(onFileSelect).not.toHaveBeenCalled();
    });

    it('should accept valid file types (PNG, JPEG, PDF)', async () => {
      const onFileSelect = vi.fn();
      render(<FileUpload onFileSelect={onFileSelect} />);

      // Create valid file
      const validFile = new File(['test'], 'test.png', { type: 'image/png' });
      const input = screen.getByLabelText(/Browse Files/i).closest('input');

      // Simulate file selection
      Object.defineProperty(input, 'files', {
        value: [validFile],
        writable: false,
      });
      fireEvent.change(input!);

      // Should show file info
      await waitFor(() => {
        expect(screen.getByText('test.png')).toBeInTheDocument();
      });

      // Should show process button
      const processButton = screen.getByText(/Process Fax/i);
      expect(processButton).toBeInTheDocument();

      // Click process button
      fireEvent.click(processButton);

      // Should call onFileSelect
      expect(onFileSelect).toHaveBeenCalledWith(validFile);
    });

    it('should validate file size (max 5MB)', async () => {
      const onFileSelect = vi.fn();
      render(<FileUpload onFileSelect={onFileSelect} />);

      // Create oversized file (6MB)
      const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'large.png', {
        type: 'image/png',
      });
      const input = screen.getByLabelText(/Browse Files/i).closest('input');

      // Simulate file selection
      Object.defineProperty(input, 'files', {
        value: [largeFile],
        writable: false,
      });
      fireEvent.change(input!);

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/File too large/i)).toBeInTheDocument();
      });

      // Should not call onFileSelect
      expect(onFileSelect).not.toHaveBeenCalled();
    });
  });

  describe('Processing Status', () => {
    it('should display processing steps in real-time', async () => {
      const { rerender } = render(<ProcessingStatus isProcessing={false} />);

      // Initially should not render
      expect(screen.queryByText(/Processing Fax/i)).not.toBeInTheDocument();

      // Start processing
      rerender(<ProcessingStatus isProcessing={true} />);

      // Should show processing UI
      expect(screen.getByText(/Processing Fax/i)).toBeInTheDocument();
      expect(screen.getByText(/elapsed/i)).toBeInTheDocument();

      // Should show progress bar
      const progressBar = document.querySelector('[class*="bg-primary"]');
      expect(progressBar).toBeInTheDocument();

      // Should show processing steps
      expect(screen.getByText(/Receiving fax image/i)).toBeInTheDocument();
      expect(screen.getByText(/Analyzing image with AI Vision/i)).toBeInTheDocument();
    });

    it('should show estimated time remaining', async () => {
      render(<ProcessingStatus isProcessing={true} />);

      // Should show time estimate
      await waitFor(() => {
        expect(screen.getByText(/remaining/i)).toBeInTheDocument();
      });
    });
  });

  describe('Results Display', () => {
    it('should display all processing results', () => {
      const { container } = render(<ResultsDisplay result={mockResult} />);

      // Should show completion message
      expect(screen.getAllByText(/Processing Complete/i).length).toBeGreaterThan(0);

      // Should show extracted text
      expect(screen.getAllByText(/Extracted Text/i).length).toBeGreaterThan(0);
      expect(container.textContent).toContain(mockResult.extractedText);

      // Should show annotations
      expect(screen.getAllByText(/Visual Annotations/i).length).toBeGreaterThan(0);

      // Should show intent
      expect(screen.getAllByText(/Identified Intent/i).length).toBeGreaterThan(0);
      expect(container.textContent).toContain(mockResult.intent.primary);

      // Should show confidence scores
      expect(screen.getAllByText(/AI Confidence/i).length).toBeGreaterThan(0);

      // Should show processing time
      expect(screen.getAllByText(/Processing Time/i).length).toBeGreaterThan(0);
    });

    it('should display confidence scores and processing time', () => {
      const { container } = render(<ResultsDisplay result={mockResult} />);

      // Check confidence percentage
      const confidenceText = (mockResult.confidence * 100).toFixed(1);
      expect(container.textContent).toContain(confidenceText);

      // Check processing time
      const timeText = (mockResult.processingTime / 1000).toFixed(2);
      expect(container.textContent).toContain(timeText);
    });

    it('should display visualization data with bounding boxes', () => {
      const { container } = render(<ResultsDisplay result={mockResult} />);

      // Should show visual analysis section
      expect(screen.getAllByText(/Visual Analysis/i).length).toBeGreaterThan(0);

      // Should show detected regions
      expect(container.textContent).toContain('Detected Regions');
      expect(container.textContent).toContain('Text Region');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty results gracefully', () => {
      const emptyResult: ProcessingResult = {
        faxId: 'empty-123',
        extractedText: '',
        annotations: [],
        intent: {
          primary: 'unknown',
          parameters: {},
          confidence: 0,
        },
        confidence: 0,
        processingTime: 0,
        visualizationData: {
          regions: [],
        },
      };

      render(<ResultsDisplay result={emptyResult} />);

      // Should still render all sections
      expect(screen.getByText(/Processing Complete/i)).toBeInTheDocument();
      expect(screen.getByText(/Extracted Text/i)).toBeInTheDocument();
      expect(screen.getByText(/Identified Intent/i)).toBeInTheDocument();
    });
  });
});
