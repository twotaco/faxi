'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Github } from 'lucide-react';

export function Header({ locale }: { locale: string }) {
  const t = useTranslations('navigation');
  const pathname = usePathname();

  const toggleLocale = () => {
    const newLocale = locale === 'ja' ? 'en' : 'ja';
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    window.location.href = newPath;
  };

  const navItems = [
    { href: `/${locale}`, label: t('home') },
    { href: `/${locale}/service`, label: t('service') },
    { href: `/${locale}/partnering`, label: t('partnering') },
    { href: `/${locale}/demo`, label: t('demo') },
    { href: `/${locale}/tech`, label: t('tech') },
    { href: `/${locale}/about`, label: t('about') },
  ];

  return (
    <header className="border-b sticky top-0 bg-background z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href={`/${locale}`} className="text-2xl font-bold">
          Faxi
        </Link>
        
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium hover:underline"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            asChild
          >
            <a
              href="https://github.com/faxi-ai/faxi"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub Repository"
            >
              <Github className="h-5 w-5" />
            </a>
          </Button>
          
          <Button onClick={toggleLocale} variant="outline" size="sm">
            {locale === 'ja' ? 'EN' : 'JP'}
          </Button>
        </div>
      </div>
    </header>
  );
}
