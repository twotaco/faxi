import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MCPIntegration } from '../MCPIntegration';

describe('MCPIntegration', () => {
  it('renders the MCP integration card', () => {
    render(<MCPIntegration />);
    
    expect(screen.getByText('MCP Integration')).toBeInTheDocument();
    expect(screen.getByText(/Model Context Protocol servers/)).toBeInTheDocument();
  });

  it('displays MCP overview', () => {
    render(<MCPIntegration />);
    
    expect(screen.getByText('What is MCP?')).toBeInTheDocument();
    expect(screen.getAllByText(/Model Context Protocol/).length).toBeGreaterThan(0);
  });

  it('shows all available MCP servers', () => {
    render(<MCPIntegration />);
    
    expect(screen.getByText('Email MCP')).toBeInTheDocument();
    expect(screen.getByText('Shopping MCP')).toBeInTheDocument();
    expect(screen.getByText('AI Chat MCP')).toBeInTheDocument();
    expect(screen.getByText('Payment MCP')).toBeInTheDocument();
    expect(screen.getByText('Appointment MCP')).toBeInTheDocument();
  });

  it('expands server details when clicked', () => {
    render(<MCPIntegration />);
    
    const emailButton = screen.getByRole('button', { name: /Email MCP/i });
    fireEvent.click(emailButton);
    
    // Check for expanded content
    expect(screen.getByText('Capabilities:')).toBeInTheDocument();
    expect(screen.getByText(/Send emails with attachments/)).toBeInTheDocument();
  });

  it('collapses server details when clicked again', () => {
    render(<MCPIntegration />);
    
    const emailButton = screen.getByRole('button', { name: /Email MCP/i });
    
    // Expand
    fireEvent.click(emailButton);
    expect(screen.getByText('Capabilities:')).toBeInTheDocument();
    
    // Collapse
    fireEvent.click(emailButton);
    expect(screen.queryByText('Capabilities:')).not.toBeInTheDocument();
  });

  it('displays extensibility section', () => {
    render(<MCPIntegration />);
    
    expect(screen.getByText('Extensibility')).toBeInTheDocument();
    expect(screen.getByText(/infinitely extensible/)).toBeInTheDocument();
  });

  it('shows extensibility examples', () => {
    render(<MCPIntegration />);
    
    expect(screen.getByText('Healthcare')).toBeInTheDocument();
    expect(screen.getByText('Government')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  it('has code example toggle', () => {
    render(<MCPIntegration />);
    
    const toggleButton = screen.getByRole('button', { name: /Show Code Example/i });
    expect(toggleButton).toBeInTheDocument();
    
    // Click to show code
    fireEvent.click(toggleButton);
    expect(screen.getByText(/Hide Code Example/i)).toBeInTheDocument();
    expect(screen.getByText(/class WeatherMCPServer/)).toBeInTheDocument();
  });

  it('displays MCP benefits', () => {
    render(<MCPIntegration />);
    
    expect(screen.getByText('Why MCP Matters')).toBeInTheDocument();
    expect(screen.getByText(/Standardized:/)).toBeInTheDocument();
    expect(screen.getByText(/Secure:/)).toBeInTheDocument();
    expect(screen.getByText(/Scalable:/)).toBeInTheDocument();
  });
});
