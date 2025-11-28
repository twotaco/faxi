import * as React from 'react';
import Link from 'next/link';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

export interface CTAButtonProps extends Omit<ButtonProps, 'asChild'> {
  href?: string;
  audience?: 'families' | 'partners' | 'investors';
  priority?: 'primary' | 'secondary';
  external?: boolean;
  showArrow?: boolean;
}

const CTAButton = React.forwardRef<HTMLButtonElement, CTAButtonProps>(
  ({
    className,
    href,
    audience = 'families',
    priority = 'primary',
    external = false,
    showArrow = false,
    children,
    variant,
    size = 'lg',
    ...props
  }, ref) => {
    // Determine variant based on priority if not explicitly set
    const buttonVariant = variant || (priority === 'primary' ? 'default' : 'outline');

    // Modern audience-specific styling with Faxi brand colors
    const audienceClasses = {
      families: priority === 'primary'
        ? 'bg-faxi-brown hover:bg-faxi-brown-dark text-white shadow-lg hover:shadow-xl'
        : 'border-2 border-faxi-brown text-faxi-brown hover:bg-faxi-brown hover:text-white',
      partners: priority === 'primary'
        ? 'bg-faxi-accent hover:bg-faxi-accent/90 text-white shadow-lg hover:shadow-xl'
        : 'border-2 border-faxi-accent text-faxi-accent hover:bg-faxi-accent hover:text-white',
      investors: priority === 'primary'
        ? 'bg-faxi-brown-light hover:bg-faxi-brown text-white shadow-lg hover:shadow-xl'
        : 'border-2 border-faxi-brown-light text-faxi-brown-light hover:bg-faxi-brown-light hover:text-white',
    };

    const buttonClasses = cn(
      'font-semibold transition-all duration-300 rounded-full px-8 group',
      audienceClasses[audience],
      className
    );

    const content = (
      <>
        {children}
        {showArrow && (
          <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
        )}
      </>
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
              {content}
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
            {content}
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
        {content}
      </Button>
    );
  }
);

CTAButton.displayName = 'CTAButton';

export { CTAButton };
