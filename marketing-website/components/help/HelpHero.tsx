'use client';

import { useTranslations } from 'next-intl';
import { Search, BookOpen, HelpCircle, Wrench, Phone } from 'lucide-react';

interface HelpHeroProps {
  locale: string;
}

export function HelpHero({ locale }: HelpHeroProps) {
  const t = useTranslations('help');

  const quickLinks = [
    {
      id: 'getting-started',
      icon: BookOpen,
      label: t('gettingStarted.title'),
      href: '#getting-started',
    },
    {
      id: 'instructions',
      icon: HelpCircle,
      label: t('instructions.title'),
      href: '#instructions',
    },
    {
      id: 'faq',
      icon: Search,
      label: t('faq.title'),
      href: '#faq',
    },
    {
      id: 'troubleshooting',
      icon: Wrench,
      label: t('troubleshooting.title'),
      href: '#troubleshooting',
    },
    {
      id: 'contact',
      icon: Phone,
      label: locale === 'ja' ? 'お問い合わせ' : 'Contact Support',
      href: '#contact',
    },
  ];

  const handleQuickLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-faxi-brown via-faxi-brown-dark to-faxi-footer pb-36 -mt-20 pt-48">
      {/* Decorative Elements */}
      <div className="absolute top-10 right-10 w-64 h-64 bg-amber-400/20 rounded-full blur-3xl animate-blob" />
      <div className="absolute bottom-10 left-10 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-blob animation-delay-2000" />
      <div className="absolute top-1/2 right-1/4 w-48 h-48 bg-faxi-brown-light/20 rounded-full blur-3xl animate-blob animation-delay-4000" />

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20 mb-6">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-white">
              {locale === 'ja' ? 'サポートセンター' : 'Support Center'}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            {t('title')}
          </h1>

          {/* Subtitle */}
          <p className="text-lg md:text-xl text-white/90 mb-12 max-w-2xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>

          {/* Quick Navigation Links */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-12">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  key={link.id}
                  href={link.href}
                  onClick={(e) => handleQuickLinkClick(e, link.href)}
                  className="group flex flex-col items-center gap-3 bg-white/10 backdrop-blur-sm hover:bg-white/20 border border-white/20 hover:border-white/40 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl"
                >
                  <div className="w-12 h-12 rounded-full bg-amber-400/20 flex items-center justify-center group-hover:bg-amber-400/30 transition-colors">
                    <Icon className="w-6 h-6 text-amber-400" />
                  </div>
                  <span className="text-sm font-medium text-white text-center leading-tight">
                    {link.label}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          viewBox="0 0 1440 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto"
        >
          <path
            d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            className="fill-white dark:fill-gray-900"
          />
        </svg>
      </div>
    </section>
  );
}
