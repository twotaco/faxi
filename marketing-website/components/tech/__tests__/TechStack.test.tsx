import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TechStack } from '../TechStack';

describe('TechStack', () => {
  it('renders the tech stack card', () => {
    render(<TechStack />);
    
    expect(screen.getByText('Technology Stack')).toBeInTheDocument();
    expect(screen.getByText(/Modern, scalable technologies/)).toBeInTheDocument();
  });

  it('displays all technology categories', () => {
    render(<TechStack />);
    
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByText('Backend')).toBeInTheDocument();
    expect(screen.getByText('AI & Machine Learning')).toBeInTheDocument();
    expect(screen.getByText('Infrastructure')).toBeInTheDocument();
  });

  it('shows frontend technologies', () => {
    render(<TechStack />);
    
    expect(screen.getByText('Next.js 14')).toBeInTheDocument();
    expect(screen.getByText('React 18')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Tailwind CSS')).toBeInTheDocument();
  });

  it('shows backend technologies', () => {
    render(<TechStack />);
    
    expect(screen.getByText('Express.js')).toBeInTheDocument();
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('Redis')).toBeInTheDocument();
    expect(screen.getByText('AWS S3')).toBeInTheDocument();
  });

  it('shows AI technologies', () => {
    render(<TechStack />);
    
    expect(screen.getByText('Claude (Anthropic)')).toBeInTheDocument();
    expect(screen.getByText('GPT-4 Vision')).toBeInTheDocument();
    expect(screen.getByText('Custom ML Models')).toBeInTheDocument();
  });

  it('shows infrastructure technologies', () => {
    render(<TechStack />);
    
    expect(screen.getByText('Telnyx')).toBeInTheDocument();
    expect(screen.getByText('Vercel')).toBeInTheDocument();
    expect(screen.getByText('Docker')).toBeInTheDocument();
  });

  it('includes technology descriptions', () => {
    render(<TechStack />);
    
    // Check that descriptions are present
    expect(screen.getByText(/React framework with App Router/)).toBeInTheDocument();
    expect(screen.getByText(/Fast, minimalist web framework/)).toBeInTheDocument();
  });

  it('displays "Why This Stack?" section', () => {
    render(<TechStack />);
    
    expect(screen.getByText('Why This Stack?')).toBeInTheDocument();
    expect(screen.getByText(/Performance:/)).toBeInTheDocument();
    expect(screen.getByText(/Scalability:/)).toBeInTheDocument();
    expect(screen.getByText(/Reliability:/)).toBeInTheDocument();
  });
});
