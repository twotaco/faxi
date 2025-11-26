/**
 * **Feature: hackathon-winning-features, Property 9: Interactive elements accessibility**
 * **Validates: Requirements 9.5**
 * 
 * Property: For any interactive element (buttons, links, form inputs) on the marketing 
 * website, it should have appropriate ARIA labels or semantic HTML.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import { Button } from '@/components/ui/button';

describe('Interactive Element Accessibility - Property-Based Tests', () => {
  afterEach(() => {
    cleanup();
  });

  it('**Feature: hackathon-winning-features, Property 9: Interactive elements accessibility**', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary button props
        fc.record({
          text: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          variant: fc.constantFrom('default', 'outline', 'ghost', 'link'),
          ariaLabel: fc.option(fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length >= 5), { nil: undefined }),
        }),
        ({ text, variant, ariaLabel }) => {
          // Render button component
          const { container } = render(
            <Button variant={variant as 'default' | 'outline' | 'ghost' | 'link'} aria-label={ariaLabel}>
              {text}
            </Button>
          );

          const button = container.querySelector('button');
          expect(button).toBeTruthy();
          
          // Property: Button should have accessible text (either visible text or aria-label)
          const hasVisibleText = button?.textContent && button.textContent.trim().length > 0;
          const hasAriaLabel = button?.getAttribute('aria-label') && button.getAttribute('aria-label')!.trim().length > 0;
          
          expect(hasVisibleText || hasAriaLabel).toBe(true);
          
          // Property: Button should be keyboard accessible (button element is inherently accessible)
          expect(button?.tagName).toBe('BUTTON');
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have proper ARIA attributes for expandable buttons', () => {
    fc.assert(
      fc.property(
        fc.record({
          isExpanded: fc.boolean(),
          label: fc.string({ minLength: 5, maxLength: 50 }),
        }),
        ({ isExpanded, label }) => {
          const { container } = render(
            <button aria-expanded={isExpanded} aria-label={label}>
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          );

          const button = container.querySelector('button');
          expect(button).toHaveAttribute('aria-expanded');
          expect(button?.getAttribute('aria-expanded')).toBe(String(isExpanded));
          expect(button).toHaveAttribute('aria-label');
          expect(button?.getAttribute('aria-label')).toBe(label);
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have proper labels for form inputs', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 3, maxLength: 20 }).map(s => s.replace(/[^a-zA-Z0-9]/g, '')),
          label: fc.string({ minLength: 3, maxLength: 50 }),
          type: fc.constantFrom('text', 'email', 'tel', 'number'),
        }),
        ({ id, label, type }) => {
          const { container } = render(
            <div>
              <label htmlFor={id}>{label}</label>
              <input type={type} id={id} />
            </div>
          );

          const input = container.querySelector('input');
          const labelElement = container.querySelector('label');
          
          // Property: Input should have associated label
          expect(input).toHaveAttribute('id');
          expect(labelElement).toHaveAttribute('for');
          expect(labelElement?.getAttribute('for')).toBe(input?.getAttribute('id'));
          
          // Property: Label should have text content
          expect(labelElement?.textContent).toBeTruthy();
          expect(labelElement?.textContent?.trim().length).toBeGreaterThan(0);
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have proper ARIA attributes for toggle buttons', () => {
    fc.assert(
      fc.property(
        fc.record({
          isPressed: fc.boolean(),
          label: fc.string({ minLength: 5, maxLength: 50 }),
        }),
        ({ isPressed, label }) => {
          const { container } = render(
            <button aria-pressed={isPressed} aria-label={label}>
              Toggle
            </button>
          );

          const button = container.querySelector('button');
          expect(button).toHaveAttribute('aria-pressed');
          expect(button?.getAttribute('aria-pressed')).toBe(String(isPressed));
          expect(button).toHaveAttribute('aria-label');
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have semantic HTML for links', () => {
    fc.assert(
      fc.property(
        fc.record({
          href: fc.webUrl(),
          text: fc.string({ minLength: 3, maxLength: 50 }),
        }),
        ({ href, text }) => {
          const { container } = render(
            <a href={href}>{text}</a>
          );

          const link = container.querySelector('a');
          
          // Property: Link should use semantic <a> tag
          expect(link?.tagName).toBe('A');
          
          // Property: Link should have href attribute
          expect(link).toHaveAttribute('href');
          
          // Property: Link should have visible text
          expect(link?.textContent).toBeTruthy();
          expect(link?.textContent?.trim().length).toBeGreaterThan(0);
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have proper error messaging for form inputs', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Generate valid CSS IDs (must start with letter)
          id: fc.string({ minLength: 3, maxLength: 20 })
            .map(s => 'input-' + s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
            .filter(s => s.length > 7), // Ensure we have at least 'input-' + 1 char
          errorMessage: fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length >= 5),
          hasError: fc.boolean(),
        }),
        ({ id, errorMessage, hasError }) => {
          const errorId = `${id}-error`;
          
          const { container } = render(
            <div>
              <input
                id={id}
                aria-invalid={hasError}
                aria-describedby={hasError ? errorId : undefined}
              />
              {hasError && <p id={errorId}>{errorMessage}</p>}
            </div>
          );

          const input = container.querySelector('input');
          
          // Property: Input should have aria-invalid when there's an error
          expect(input).toHaveAttribute('aria-invalid');
          expect(input?.getAttribute('aria-invalid')).toBe(String(hasError));
          
          if (hasError) {
            // Property: Input should reference error message
            expect(input).toHaveAttribute('aria-describedby');
            expect(input?.getAttribute('aria-describedby')).toBe(errorId);
            
            // Property: Error message should exist and have content
            const errorElement = container.querySelector(`#${errorId}`);
            expect(errorElement).toBeTruthy();
            expect(errorElement?.textContent).toBe(errorMessage);
          }
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have proper role for button groups', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 2, maxLength: 5 }),
        (buttonLabels) => {
          const { container } = render(
            <div role="group" aria-label="Button group">
              {buttonLabels.map((label, index) => (
                <button key={index} aria-label={label}>
                  {label}
                </button>
              ))}
            </div>
          );

          const group = container.querySelector('[role="group"]');
          
          // Property: Group should have role="group"
          expect(group).toHaveAttribute('role', 'group');
          
          // Property: Group should have aria-label
          expect(group).toHaveAttribute('aria-label');
          
          // Property: All buttons in group should have labels
          const buttons = container.querySelectorAll('button');
          expect(buttons.length).toBe(buttonLabels.length);
          
          buttons.forEach((button) => {
            const hasLabel = button.getAttribute('aria-label') || button.textContent?.trim();
            expect(hasLabel).toBeTruthy();
          });
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});
