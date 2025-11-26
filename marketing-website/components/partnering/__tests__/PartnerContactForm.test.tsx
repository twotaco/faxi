import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PartnerContactForm from '../PartnerContactForm';

describe('PartnerContactForm', () => {
  const renderComponent = () => {
    return render(<PartnerContactForm />);
  };

  it('renders form with all required fields', () => {
    const { container } = renderComponent();
    
    // Check that form elements exist
    expect(container.querySelector('select[name="partnerType"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="companyName"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="contactName"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="email"]')).toBeInTheDocument();
    expect(container.querySelector('input[name="phone"]')).toBeInTheDocument();
    expect(container.querySelector('textarea[name="message"]')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('displays validation errors for empty required fields', async () => {
    renderComponent();
    
    const submitButton = screen.getByRole('button');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      // Check that error messages are displayed
      const errors = screen.getAllByRole('paragraph');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('validates email format', async () => {
    const { container } = renderComponent();
    
    const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    
    const submitButton = screen.getByRole('button');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('validates message length', async () => {
    const { container } = renderComponent();
    
    const messageInput = container.querySelector('textarea[name="message"]') as HTMLTextAreaElement;
    fireEvent.change(messageInput, { target: { value: 'Short' } });
    
    const submitButton = screen.getByRole('button');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(messageInput).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('clears error when user starts typing', async () => {
    const { container } = renderComponent();
    
    const submitButton = screen.getByRole('button');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      const companyInput = container.querySelector('input[name="companyName"]') as HTMLInputElement;
      expect(companyInput).toHaveAttribute('aria-invalid', 'true');
    });
    
    const companyInput = container.querySelector('input[name="companyName"]') as HTMLInputElement;
    fireEvent.change(companyInput, { target: { value: 'Test Company' } });
    
    await waitFor(() => {
      expect(companyInput).not.toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('submits form with valid data', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { container } = renderComponent();
    
    // Fill in all fields
    fireEvent.change(container.querySelector('select[name="partnerType"]')!, { target: { value: 'healthcare' } });
    fireEvent.change(container.querySelector('input[name="companyName"]')!, { target: { value: 'Test Clinic' } });
    fireEvent.change(container.querySelector('input[name="contactName"]')!, { target: { value: 'John Doe' } });
    fireEvent.change(container.querySelector('input[name="email"]')!, { target: { value: 'john@test.com' } });
    fireEvent.change(container.querySelector('input[name="phone"]')!, { target: { value: '03-1234-5678' } });
    fireEvent.change(container.querySelector('textarea[name="message"]')!, { target: { value: 'This is a test message with enough characters' } });
    
    const submitButton = screen.getByRole('button');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      // Check that success message appears
      expect(container.querySelector('.bg-green-50')).toBeInTheDocument();
    });
    
    consoleSpy.mockRestore();
  });

  it('includes all partner type options', () => {
    const { container } = renderComponent();
    
    const select = container.querySelector('select[name="partnerType"]');
    const options = select?.querySelectorAll('option');
    
    // Should have 7 options (placeholder + 6 partner types)
    expect(options?.length).toBe(7);
  });

  it('has proper ARIA attributes for accessibility', async () => {
    const { container } = renderComponent();
    
    const submitButton = screen.getByRole('button');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      const partnerTypeSelect = container.querySelector('select[name="partnerType"]');
      expect(partnerTypeSelect).toHaveAttribute('aria-invalid', 'true');
      expect(partnerTypeSelect).toHaveAttribute('aria-describedby', 'partnerType-error');
    });
  });
});
