import * as React from 'react';
import Link from 'next/link';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface CTAButtonProps extends Omit<ButtonProps, 'asChild'> {
  href?: string;
  audience?: 'families' | 'partners' | 'investors';
  priority?: 'primary' | 'secondary';
  external?: boolean;
}

const CTAButton = React.forwardRef<HTMLButtonElement, CTAButtonProps>(
  ({ 
    className, 
    href, 
    audience = 'families',
    priority = 'primary',
    external = false,
    children,
    variant,
    size = 'lg',
    ...props 
  }, ref) => {
    // Determine variant based on priority if not explicitly set
    const buttonVariant = variant || (priority === 'primary' ? 'default' : 'outline');
    
    // Add audience-specific styling
    const audienceClasses = {
      families: priority === 'primary' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border-blue-600 text-blue-600 hover:bg-blue-50',
      partners: priority === 'primary' ? 'bg-green-600 hover:bg-green-700 text-white' : 'border-green-600 text-green-600 hover:bg-green-50',
      investors: priority === 'primary' ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'border-purple-600 text-purple-600 hover:bg-purple-50',
    };

    const buttonClasses = cn(
      'font-semibold transition-all duration-200',
      audienceClasses[audience],
      className
    );

    if (href) {
      if (external) {
        return (
          <Button
            variant={buttonVariant}
            size={size}
            className={buttonClasses}
            asChild
            {...props}
          >
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          </Button>
        );
      }
      
      return (
        <Button
          variant={buttonVariant}
          size={size}
          className={buttonClasses}
          asChild
          {...props}
        >
          <Link href={href}>
            {children}
          </Link>
        </Button>
      );
    }

    return (
      <Button
        ref={ref}
        variant={buttonVariant}
        size={size}
        className={buttonClasses}
        {...props}
      >
        {children}
      </Button>
    );
  }
);

CTAButton.displayName = 'CTAButton';

export { CTAButton };
