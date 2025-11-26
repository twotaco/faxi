import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArchitectureDiagram } from '../ArchitectureDiagram';

describe('ArchitectureDiagram', () => {
  it('renders the architecture diagram card', () => {
    render(<ArchitectureDiagram />);
    
    expect(screen.getByText('System Architecture')).toBeInTheDocument();
    expect(screen.getByText(/High-level overview/)).toBeInTheDocument();
  });

  it('displays all major system components', () => {
    render(<ArchitectureDiagram />);
    
    // Check for key components in the diagram
    expect(screen.getAllByText(/Marketing Website/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Backend API/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AI Processing Pipeline/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/MCP Servers/).length).toBeGreaterThan(0);
  });

  it('shows infrastructure components', () => {
    render(<ArchitectureDiagram />);
    
    expect(screen.getByText('PostgreSQL')).toBeInTheDocument();
    expect(screen.getByText('Redis')).toBeInTheDocument();
    expect(screen.getByText('S3')).toBeInTheDocument();
    expect(screen.getByText('Telnyx')).toBeInTheDocument();
  });

  it('displays data flow description', () => {
    render(<ArchitectureDiagram />);
    
    expect(screen.getByText('Data Flow')).toBeInTheDocument();
    expect(screen.getByText(/User sends fax/)).toBeInTheDocument();
    expect(screen.getByText(/Backend API receives request/)).toBeInTheDocument();
    expect(screen.getByText(/AI pipeline analyzes/)).toBeInTheDocument();
  });

  it('renders SVG diagram', () => {
    const { container } = render(<ArchitectureDiagram />);
    
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 800 600');
  });
});
