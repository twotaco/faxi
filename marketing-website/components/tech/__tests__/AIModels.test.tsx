import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AIModels } from '../AIModels';

describe('AIModels', () => {
  it('renders the AI models card', () => {
    render(<AIModels />);
    
    expect(screen.getByText('AI Models & Techniques')).toBeInTheDocument();
    expect(screen.getByText(/State-of-the-art AI/)).toBeInTheDocument();
  });

  it('displays multi-model pipeline overview', () => {
    render(<AIModels />);
    
    expect(screen.getByText('Multi-Model AI Pipeline')).toBeInTheDocument();
    expect(screen.getByText(/sophisticated AI pipeline/)).toBeInTheDocument();
  });

  it('shows all core AI models', () => {
    render(<AIModels />);
    
    expect(screen.getByText('Vision AI (GPT-4 Vision)')).toBeInTheDocument();
    expect(screen.getByText('Annotation Detector')).toBeInTheDocument();
    expect(screen.getByText('Intent Classifier (Claude)')).toBeInTheDocument();
  });

  it('displays accuracy metrics for each model', () => {
    render(<AIModels />);
    
    // Check for accuracy percentages
    expect(screen.getByText('92%')).toBeInTheDocument(); // Vision AI
    expect(screen.getByText('88%')).toBeInTheDocument(); // Annotation Detector
    expect(screen.getByText('95%')).toBeInTheDocument(); // Intent Classifier
  });

  it('shows model purposes and descriptions', () => {
    render(<AIModels />);
    
    expect(screen.getByText(/Optical Character Recognition/)).toBeInTheDocument();
    expect(screen.getByText(/Visual Annotation Recognition/)).toBeInTheDocument();
    expect(screen.getByText(/Natural Language Understanding/)).toBeInTheDocument();
  });

  it('displays techniques for each model', () => {
    render(<AIModels />);
    
    // Vision AI techniques
    expect(screen.getByText('Multimodal deep learning')).toBeInTheDocument();
    expect(screen.getAllByText('Handwriting recognition').length).toBeGreaterThan(0);
    
    // Annotation Detector techniques
    expect(screen.getByText('Convolutional neural networks')).toBeInTheDocument();
    expect(screen.getByText('Shape recognition')).toBeInTheDocument();
    
    // Intent Classifier techniques
    expect(screen.getByText('Large language models')).toBeInTheDocument();
    expect(screen.getByText('Entity extraction')).toBeInTheDocument();
  });

  it('shows processing pipeline stages', () => {
    render(<AIModels />);
    
    expect(screen.getByText('Processing Pipeline')).toBeInTheDocument();
    expect(screen.getByText('Image Preprocessing')).toBeInTheDocument();
    expect(screen.getByText('Vision Analysis')).toBeInTheDocument();
    expect(screen.getByText('Annotation Detection')).toBeInTheDocument();
    expect(screen.getByText('Intent Extraction')).toBeInTheDocument();
    expect(screen.getByText('Confidence Scoring')).toBeInTheDocument();
  });

  it('displays key innovations', () => {
    render(<AIModels />);
    
    expect(screen.getByText('Key Innovations')).toBeInTheDocument();
    expect(screen.getByText('Context-Aware Processing')).toBeInTheDocument();
    expect(screen.getByText('Iterative Refinement')).toBeInTheDocument();
    expect(screen.getByText('Multilingual Support')).toBeInTheDocument();
    expect(screen.getByText('Confidence Calibration')).toBeInTheDocument();
  });

  it('shows overall performance metrics', () => {
    render(<AIModels />);
    
    expect(screen.getByText('Overall Performance')).toBeInTheDocument();
    expect(screen.getAllByText('90%+').length).toBeGreaterThan(0); // Overall Accuracy
    expect(screen.getAllByText('<5s').length).toBeGreaterThan(0); // Avg Processing Time
    expect(screen.getAllByText('10+').length).toBeGreaterThan(0); // Supported Use Cases
  });

  it('includes technical evaluator section', () => {
    render(<AIModels />);
    
    expect(screen.getByText('For Technical Evaluators')).toBeInTheDocument();
    expect(screen.getByText(/transfer learning/)).toBeInTheDocument();
    expect(screen.getByText(/ensemble methods/)).toBeInTheDocument();
  });
});
