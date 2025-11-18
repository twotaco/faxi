'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

export function Breadcrumb() {
  const pathname = usePathname();

  // Generate breadcrumb items from pathname
  const generateBreadcrumbs = () => {
    if (!pathname || pathname === '/') return [];

    const paths = pathname.split('/').filter(Boolean);
    const breadcrumbs = paths.map((path, index) => {
      const href = '/' + paths.slice(0, index + 1).join('/');
      const label = path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, ' ');
      
      return { label, href };
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  if (breadcrumbs.length === 0) return null;

  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
      <Link 
        href="/dashboard" 
        className="flex items-center hover:text-faxi-orange transition-colors"
      >
        <Home className="w-4 h-4" />
      </Link>

      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;

        return (
          <div key={crumb.href} className="flex items-center space-x-2">
            <ChevronRight className="w-4 h-4 text-gray-400" />
            {isLast ? (
              <span className="font-medium text-gray-800">{crumb.label}</span>
            ) : (
              <Link 
                href={crumb.href}
                className="hover:text-faxi-orange transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
