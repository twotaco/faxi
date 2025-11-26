import * as React from 'react';
import { CTAButton } from './cta-button';
import { cn } from '@/lib/utils';

export interface CTAConfig {
  text: string;
  href: string;
  priority?: 'primary' | 'secondary';
  external?: boolean;
}

export interface CTASectionProps {
  audience?: 'families' | 'partners' | 'investors';
  ctas: CTAConfig[];
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export function CTASection({ 
  audience = 'families', 
  ctas, 
  className,
  orientation = 'horizontal'
}: CTASectionProps) {
  const containerClasses = cn(
    'flex gap-4',
    orientation === 'horizontal' ? 'flex-row flex-wrap' : 'flex-col',
    className
  );

  return (
    <div className={containerClasses}>
      {ctas.map((cta, index) => (
        <CTAButton
          key={index}
          href={cta.href}
          audience={audience}
          priority={cta.priority || (index === 0 ? 'primary' : 'secondary')}
          external={cta.external}
        >
          {cta.text}
        </CTAButton>
      ))}
    </div>
  );
}
