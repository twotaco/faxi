'use client';

import { useTranslations } from 'next-intl';
import { CTAButton } from '@/components/ui/cta-button';

interface HeroSectionProps {
  locale: string;
}

export function HeroSection({ locale }: HeroSectionProps) {
  const t = useTranslations('home.hero.families');

  return (
    <section className="relative bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-16 md:py-24 lg:py-32">
        {/* Hero Content */}
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {t('headline')}
          </h1>
          
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            {t('subheadline')}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <CTAButton
              href={`/${locale}/service`}
              audience="families"
              priority="primary"
              className="w-full sm:w-auto"
            >
              {t('ctaPrimary')}
            </CTAButton>
            <CTAButton
              href={`/${locale}/demo`}
              audience="families"
              priority="secondary"
              className="w-full sm:w-auto"
            >
              {t('ctaSecondary')}
            </CTAButton>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-0 left-1/2 w-64 h-64 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>
    </section>
  );
}
