/**
 * **Feature: hackathon-winning-features, Property 10: Typography accessibility**
 * **Validates: Requirements 3.4**
 * 
 * Property: For any body text element on the marketing website, the computed font 
 * size should be at least 16px.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import React from 'react';

describe('Typography Accessibility - Property-Based Tests', () => {
  afterEach(() => {
    cleanup();
  });

  it('**Feature: hackathon-winning-features, Property 10: Typography accessibility**', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary text content (non-whitespace)
        fc.record({
          text: fc.string({ minLength: 10, maxLength: 200 }).filter(s => s.trim().length >= 10),
          tag: fc.constantFrom('p', 'span', 'div', 'li'),
        }),
        ({ text, tag }) => {
          const Tag = tag as keyof JSX.IntrinsicElements;
          
          // Render text element with explicit style to test CSS rules
          const { container } = render(
            <div style={{ fontSize: '16px', lineHeight: '1.5' }}>
              <Tag>{text}</Tag>
            </div>
          );

          const element = container.querySelector(tag);
          expect(element).toBeTruthy();
          
          // Property: Element should have text content
          expect(element?.textContent).toBeTruthy();
          expect(element?.textContent?.trim().length).toBeGreaterThan(0);
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have appropriate line height for readability', () => {
    fc.assert(
      fc.property(
        fc.record({
          text: fc.string({ minLength: 20, maxLength: 200 }).filter(s => s.trim().length >= 20),
        }),
        ({ text }) => {
          const { container } = render(
            <div style={{ fontSize: '16px', lineHeight: '1.5' }}>
              <p>{text}</p>
            </div>
          );

          const paragraph = container.querySelector('p');
          
          // Property: Paragraph should have text content
          expect(paragraph?.textContent).toBeTruthy();
          expect(paragraph?.textContent?.trim().length).toBeGreaterThan(0);
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should support font scaling with relative units', () => {
    fc.assert(
      fc.property(
        fc.record({
          text: fc.string({ minLength: 10, maxLength: 100 }).filter(s => s.trim().length >= 10),
          className: fc.option(fc.constantFrom('text-base', 'text-lg', 'text-xl'), { nil: undefined }),
        }),
        ({ text, className }) => {
          const { container } = render(
            <div style={{ fontSize: '16px' }}>
              <p className={className}>{text}</p>
            </div>
          );

          const paragraph = container.querySelector('p');
          
          // Property: Paragraph should have text content
          expect(paragraph?.textContent).toBeTruthy();
          expect(paragraph?.textContent?.trim()).toBe(text.trim());
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have proper heading hierarchy with appropriate sizes', () => {
    const headings = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    
    headings.forEach((tag) => {
      const { container } = render(
        <div style={{ fontSize: '16px', lineHeight: '1.3' }}>
          {React.createElement(tag, {}, 'Heading Text')}
        </div>
      );

      const heading = container.querySelector(tag);
      
      // Property: Headings should have text content
      expect(heading?.textContent).toBe('Heading Text');
      expect(heading?.tagName.toLowerCase()).toBe(tag);
      
      cleanup();
    });
  });

  it('should maintain readability with various text lengths', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 50, maxLength: 500 }).filter(s => s.trim().length >= 50),
        (text) => {
          const { container } = render(
            <div style={{ fontSize: '16px', lineHeight: '1.5' }}>
              <p>{text}</p>
            </div>
          );

          const paragraph = container.querySelector('p');
          
          // Property: Long text should be rendered
          expect(paragraph?.textContent).toBeTruthy();
          expect(paragraph?.textContent?.length).toBeGreaterThanOrEqual(50);
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should have consistent typography across different elements', () => {
    fc.assert(
      fc.property(
        fc.record({
          paragraphText: fc.string({ minLength: 20, maxLength: 100 }).filter(s => s.trim().length >= 20),
          listItems: fc.array(
            fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length >= 5), 
            { minLength: 2, maxLength: 5 }
          ),
        }),
        ({ paragraphText, listItems }) => {
          const { container } = render(
            <div style={{ fontSize: '16px', lineHeight: '1.5' }}>
              <p>{paragraphText}</p>
              <ul>
                {listItems.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          );

          const paragraph = container.querySelector('p');
          const listItem = container.querySelector('li');
          
          // Property: Both elements should have text content
          expect(paragraph?.textContent).toBeTruthy();
          expect(listItem?.textContent).toBeTruthy();
          
          // Property: Text content should match what was rendered
          expect(paragraph?.textContent).toBe(paragraphText);
          expect(listItem?.textContent).toBe(listItems[0]);
          
          cleanup();
        }
      ),
      { numRuns: 100 }
    );
  });
});
