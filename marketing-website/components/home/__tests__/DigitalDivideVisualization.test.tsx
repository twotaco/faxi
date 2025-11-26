import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DigitalDivideVisualization } from '../DigitalDivideVisualization';

// Mock useTranslations
vi.mock('next-intl', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  useTranslations: (_namespace: string) => (key: string) => {
    const translations: Record<string, string> = {
      'title': 'Understanding the Digital Divide',
      'subtitle': 'Data-driven insights',
      'internetUsage.title': 'Internet Usage by Age',
      'internetUsage.description': 'Percentage using internet',
      'internetUsage.barLabel': 'Internet Usage %',
      'internetUsage.source': 'Source: Ministry of Internal Affairs',
      'internetUsage.data.60-64.label': '60-64',
      'internetUsage.data.65-69.label': '65-69',
      'internetUsage.data.70-74.label': '70-74',
      'internetUsage.data.75-79.label': '75-79',
      'internetUsage.data.80plus.label': '80+',
      'communicationMethods.title': 'Communication Methods',
      'communicationMethods.description': 'How elderly communicate',
      'communicationMethods.source': 'Source: Japan Business Machine Association',
      'communicationMethods.data.fax.label': 'Fax Users',
      'communicationMethods.data.internet.label': 'Internet Users',
      'communicationMethods.data.neither.label': 'Neither',
      'accessibility.title': 'Service Accessibility Gap',
      'accessibility.description': 'Comparison of access rates',
      'accessibility.withInternetLabel': 'With Internet',
      'accessibility.withoutInternetLabel': 'Without Internet',
      'accessibility.source': 'Source: Consumer Affairs Agency',
      'accessibility.data.healthcare.label': 'Healthcare',
      'accessibility.data.shopping.label': 'Shopping',
      'accessibility.data.government.label': 'Government',
      'accessibility.data.banking.label': 'Banking',
      'insights.title': 'Key Insights',
      'insights.point1': 'Internet usage drops after 75',
      'insights.point2': '10M elderly use fax',
      'insights.point3': 'Service access drops 50-60%',
      'insights.point4': 'Faxi bridges the gap'
    };
    
    return translations[key] || key;
  }
}));

// Mock Recharts components
vi.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />
}));

describe('DigitalDivideVisualization', () => {
  it('should render the title and subtitle', () => {
    render(<DigitalDivideVisualization />);
    
    expect(screen.getByText('Understanding the Digital Divide')).toBeTruthy();
    expect(screen.getByText('Data-driven insights')).toBeTruthy();
  });

  it('should render three chart sections', () => {
    render(<DigitalDivideVisualization />);
    
    // Check for chart titles
    expect(screen.getByText('Internet Usage by Age')).toBeTruthy();
    expect(screen.getByText('Communication Methods')).toBeTruthy();
    expect(screen.getByText('Service Accessibility Gap')).toBeTruthy();
  });

  it('should display chart descriptions', () => {
    render(<DigitalDivideVisualization />);
    
    expect(screen.getByText('Percentage using internet')).toBeTruthy();
    expect(screen.getByText('How elderly communicate')).toBeTruthy();
    expect(screen.getByText('Comparison of access rates')).toBeTruthy();
  });

  it('should display source citations for all charts', () => {
    render(<DigitalDivideVisualization />);
    
    // Check for source text
    const sourceElements = screen.getAllByText(/Source:/);
    expect(sourceElements.length).toBe(3);
    
    // Check for specific sources
    expect(screen.getByText(/Ministry of Internal Affairs/)).toBeTruthy();
    expect(screen.getByText(/Japan Business Machine Association/)).toBeTruthy();
    expect(screen.getByText(/Consumer Affairs Agency/)).toBeTruthy();
  });

  it('should render bar charts', () => {
    const { container } = render(<DigitalDivideVisualization />);
    
    const barCharts = container.querySelectorAll('[data-testid="bar-chart"]');
    expect(barCharts.length).toBe(2); // Internet usage and accessibility charts
  });

  it('should render pie chart', () => {
    const { container } = render(<DigitalDivideVisualization />);
    
    const pieCharts = container.querySelectorAll('[data-testid="pie-chart"]');
    expect(pieCharts.length).toBe(1); // Communication methods chart
  });

  it('should display key insights section', () => {
    render(<DigitalDivideVisualization />);
    
    expect(screen.getByText('Key Insights')).toBeTruthy();
    expect(screen.getByText('Internet usage drops after 75')).toBeTruthy();
    expect(screen.getByText('10M elderly use fax')).toBeTruthy();
    expect(screen.getByText('Service access drops 50-60%')).toBeTruthy();
    expect(screen.getByText('Faxi bridges the gap')).toBeTruthy();
  });

  it('should have proper styling for chart containers', () => {
    const { container } = render(<DigitalDivideVisualization />);
    
    const chartContainers = container.querySelectorAll('[class*="bg-white"]');
    
    // Should have at least 3 chart containers
    expect(chartContainers.length).toBeGreaterThanOrEqual(3);
    
    chartContainers.forEach((chartContainer) => {
      // Check for rounded corners
      expect(chartContainer.className).toContain('rounded');
      
      // Check for shadow
      expect(chartContainer.className).toContain('shadow');
    });
  });

  it('should have insights section with proper styling', () => {
    const { container } = render(<DigitalDivideVisualization />);
    
    // Find insights container
    const insightsContainer = container.querySelector('[class*="bg-blue-50"]');
    expect(insightsContainer).toBeTruthy();
    
    // Check for border
    expect(insightsContainer?.className).toContain('border-l-4');
    expect(insightsContainer?.className).toContain('border-blue-500');
  });

  it('should have accessible structure', () => {
    const { container } = render(<DigitalDivideVisualization />);
    
    // Check for section element
    const section = container.querySelector('section');
    expect(section).toBeTruthy();
    
    // Check for main heading
    const heading = container.querySelector('h2');
    expect(heading).toBeTruthy();
    expect(heading?.textContent).toBe('Understanding the Digital Divide');
    
    // Check for chart subheadings (h3)
    const chartHeadings = container.querySelectorAll('h3');
    expect(chartHeadings.length).toBe(3); // 3 charts
    
    // Check for insights heading (h4)
    const insightsHeading = container.querySelector('h4');
    expect(insightsHeading).toBeTruthy();
    expect(insightsHeading?.textContent).toBe('Key Insights');
  });

  it('should display all chart sources with italic styling', () => {
    const { container } = render(<DigitalDivideVisualization />);
    
    const sourceElements = container.querySelectorAll('[class*="italic"]');
    
    // Should have at least 3 source citations (one per chart)
    expect(sourceElements.length).toBeGreaterThanOrEqual(3);
    
    sourceElements.forEach((element) => {
      expect(element.textContent).toContain('Source:');
    });
  });
});
