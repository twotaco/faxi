'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export function Header({ locale }: { locale: string }) {
  const t = useTranslations('navigation');
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Check if we're on the home page (which has a dark hero background)
  const isHomePage = pathname === `/${locale}` || pathname === `/${locale}/`;
  // Use light text only on home page when not scrolled
  const useLightText = isHomePage && !isScrolled;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  const isActive = (href: string) => {
    if (href === `/${locale}`) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-white/95 dark:bg-faxi-footer/95 backdrop-blur-md shadow-lg'
            : 'bg-transparent'
        }`}
      >
        <div className="container mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link href={`/${locale}`} className="flex items-center gap-3 group">
              <div className="relative w-12 h-12 rounded-full overflow-hidden shadow-md group-hover:shadow-lg transition-shadow">
                <Image
                  src="/images/faxi-logo-round.png"
                  alt="Faxi"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <span className={`text-2xl font-bold transition-colors ${
                useLightText
                  ? 'text-white drop-shadow-md'
                  : 'text-faxi-brown dark:text-white'
              }`}>
                Faxi
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    isActive(item.href)
                      ? useLightText
                        ? 'bg-white/20 text-white backdrop-blur-sm'
                        : 'bg-faxi-brown text-white'
                      : useLightText
                        ? 'text-white/90 hover:text-white hover:bg-white/10'
                        : 'text-faxi-brown/80 hover:text-faxi-brown hover:bg-faxi-brown/10'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button
                onClick={toggleLocale}
                variant="outline"
                size="sm"
                className={`font-semibold transition-all ${
                  useLightText
                    ? 'border-white text-white hover:bg-white hover:text-faxi-brown'
                    : 'border-faxi-brown text-faxi-brown hover:bg-faxi-brown hover:text-white'
                }`}
              >
                {locale === 'ja' ? 'EN' : '日本語'}
              </Button>

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                className={`lg:hidden ${
                  useLightText
                    ? 'text-white'
                    : 'text-faxi-brown'
                }`}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label="Toggle menu"
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`lg:hidden transition-all duration-300 overflow-hidden ${
            isMobileMenuOpen ? 'max-h-screen' : 'max-h-0'
          }`}
        >
          <nav className="bg-white dark:bg-faxi-footer shadow-lg px-4 py-6 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-faxi-brown text-white'
                    : 'text-faxi-brown hover:bg-faxi-brown/10'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {/* Spacer for fixed header */}
      <div className="h-20" />
    </>
  );
}
