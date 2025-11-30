import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FAQAccordion from '../FAQAccordion';

// Mock translation data
const mockTranslations: Record<string, string> = {
  'help.faq.title': 'Frequently Asked Questions',
  'help.faq.description': 'Find answers to common questions',
  'help.faq.searchPlaceholder': 'Search FAQs...',
  'help.faq.noResults': 'No FAQs match your search. Try different keywords.',
  'help.faq.categories.gettingStarted': 'Getting Started',
  'help.faq.categories.usingService': 'Using the Service',
  'help.faq.categories.troubleshooting': 'Troubleshooting',
  'help.faq.categories.billing': 'Billing',
  'help.faq.categories.privacy': 'Privacy',
  'help.faq.items.registration.category': 'gettingStarted',
  'help.faq.items.registration.question': 'How do I register for Faxi?',
  'help.faq.items.registration.answer': 'To register, send a fax to our number with your contact information.',
  'help.faq.items.cost.category': 'gettingStarted',
  'help.faq.items.cost.question': 'How much does Faxi cost?',
  'help.faq.items.cost.answer': 'Faxi costs 500 yen per month.',
  'help.faq.items.faxMachine.category': 'gettingStarted',
  'help.faq.items.faxMachine.question': 'What fax machine do I need?',
  'help.faq.items.faxMachine.answer': 'Any standard fax machine will work.',
  'help.faq.items.handwriting.category': 'usingService',
  'help.faq.items.handwriting.question': 'Can I use handwriting?',
  'help.faq.items.handwriting.answer': 'Yes, our AI can read handwritten faxes.',
  'help.faq.items.languages.category': 'usingService',
  'help.faq.items.languages.question': 'What languages are supported?',
  'help.faq.items.languages.answer': 'We support Japanese and English.',
  'help.faq.items.responseTime.category': 'usingService',
  'help.faq.items.responseTime.question': 'How long until I get a response?',
  'help.faq.items.responseTime.answer': 'Responses typically arrive within 5-10 minutes.',
  'help.faq.items.multipleRequests.category': 'usingService',
  'help.faq.items.multipleRequests.question': 'Can I send multiple requests?',
  'help.faq.items.multipleRequests.answer': 'Yes, you can send as many requests as needed.',
  'help.faq.items.followUp.category': 'usingService',
  'help.faq.items.followUp.question': 'How do I follow up?',
  'help.faq.items.followUp.answer': 'Include your reference number in follow-up faxes.',
  'help.faq.items.notReceived.category': 'troubleshooting',
  'help.faq.items.notReceived.question': 'What if I did not receive a response?',
  'help.faq.items.notReceived.answer': 'Check your fax machine and try resending.',
  'help.faq.items.unclear.category': 'troubleshooting',
  'help.faq.items.unclear.question': 'What if the response is unclear?',
  'help.faq.items.unclear.answer': 'Send a clarification request with your reference number.',
  'help.faq.items.wrongInfo.category': 'troubleshooting',
  'help.faq.items.wrongInfo.question': 'What if the information is wrong?',
  'help.faq.items.wrongInfo.answer': 'Contact support with your reference number.',
  'help.faq.items.pricing.category': 'billing',
  'help.faq.items.pricing.question': 'What are the pricing details?',
  'help.faq.items.pricing.answer': 'Monthly subscription is 500 yen with no hidden fees.',
  'help.faq.items.refund.category': 'billing',
  'help.faq.items.refund.question': 'Can I get a refund?',
  'help.faq.items.refund.answer': 'Refunds are available within 30 days.',
  'help.faq.items.dataPrivacy.category': 'privacy',
  'help.faq.items.dataPrivacy.question': 'How is my data protected?',
  'help.faq.items.dataPrivacy.answer': 'We use encryption and secure storage.',
  'help.faq.items.dataRetention.category': 'privacy',
  'help.faq.items.dataRetention.question': 'How long is data retained?',
  'help.faq.items.dataRetention.answer': 'Data is retained for 90 days.',
  'help.faq.items.whoCanSee.category': 'privacy',
  'help.faq.items.whoCanSee.question': 'Who can see my faxes?',
  'help.faq.items.whoCanSee.answer': 'Only authorized personnel can access your data.',
};

describe('FAQAccordion', () => {
  beforeEach(() => {
    // Mock useTranslations to return our test data
    vi.mock('next-intl', () => ({
      useTranslations: () => (key: string) => {
        const fullKey = `help.faq.${key}`;
        return mockTranslations[fullKey] || key;
      },
    }));
  });

  const renderComponent = () => {
    return render(<FAQAccordion />);
  };

  it('renders the FAQ section with title and description', () => {
    renderComponent();
    expect(screen.getByText('Frequently Asked Questions')).toBeInTheDocument();
    expect(screen.getByText('Find answers to common questions')).toBeInTheDocument();
  });

  it('renders search input with placeholder', () => {
    renderComponent();
    const searchInput = screen.getByPlaceholderText('Search FAQs...');
    expect(searchInput).toBeInTheDocument();
  });

  it('displays all FAQ items initially', () => {
    renderComponent();
    expect(screen.getByText('How do I register for Faxi?')).toBeInTheDocument();
    expect(screen.getByText('How much does Faxi cost?')).toBeInTheDocument();
    expect(screen.getByText('Can I use handwriting?')).toBeInTheDocument();
  });

  it('filters FAQ items based on search query', () => {
    renderComponent();
    const searchInput = screen.getByPlaceholderText('Search FAQs...');

    // Search for "handwriting"
    fireEvent.change(searchInput, { target: { value: 'handwriting' } });

    // Should show the handwriting question
    expect(screen.getByText('Can I use handwriting?')).toBeInTheDocument();

    // Should not show unrelated questions
    expect(screen.queryByText('How much does Faxi cost?')).not.toBeInTheDocument();
  });

  it('filters FAQ items by answer content', () => {
    renderComponent();
    const searchInput = screen.getByPlaceholderText('Search FAQs...');

    // Search for "encryption" which appears in an answer
    fireEvent.change(searchInput, { target: { value: 'encryption' } });

    // Should show the data privacy question
    expect(screen.getByText('How is my data protected?')).toBeInTheDocument();

    // Should not show unrelated questions
    expect(screen.queryByText('How much does Faxi cost?')).not.toBeInTheDocument();
  });

  it('shows no results message when search returns empty', () => {
    renderComponent();
    const searchInput = screen.getByPlaceholderText('Search FAQs...');

    // Search for something that doesn't exist
    fireEvent.change(searchInput, { target: { value: 'xyz123nonexistent' } });

    // Should show no results message
    expect(screen.getByText('No FAQs match your search. Try different keywords.')).toBeInTheDocument();

    // Should not show any FAQ items
    expect(screen.queryByText('How do I register for Faxi?')).not.toBeInTheDocument();
  });

  it('clears filter when search is cleared', () => {
    renderComponent();
    const searchInput = screen.getByPlaceholderText('Search FAQs...');

    // Search for something
    fireEvent.change(searchInput, { target: { value: 'handwriting' } });
    expect(screen.queryByText('How much does Faxi cost?')).not.toBeInTheDocument();

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } });

    // Should show all items again
    expect(screen.getByText('How much does Faxi cost?')).toBeInTheDocument();
    expect(screen.getByText('Can I use handwriting?')).toBeInTheDocument();
  });

  it('search is case-insensitive', () => {
    renderComponent();
    const searchInput = screen.getByPlaceholderText('Search FAQs...');

    // Search with uppercase
    fireEvent.change(searchInput, { target: { value: 'HANDWRITING' } });

    // Should still find the item
    expect(screen.getByText('Can I use handwriting?')).toBeInTheDocument();
  });

  it('expands and collapses FAQ items on click', () => {
    renderComponent();

    // Find a question button
    const questionButton = screen.getByText('How do I register for Faxi?');

    // Answer should not be visible initially
    expect(screen.queryByText('To register, send a fax to our number with your contact information.')).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(questionButton);

    // Answer should now be visible
    expect(screen.getByText('To register, send a fax to our number with your contact information.')).toBeInTheDocument();

    // Click again to collapse
    fireEvent.click(questionButton);

    // Answer should be hidden again
    expect(screen.queryByText('To register, send a fax to our number with your contact information.')).not.toBeInTheDocument();
  });
});
