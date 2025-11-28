'use client';

import { useTranslations } from 'next-intl';
import { CTAButton } from '@/components/ui/cta-button';

interface FamiliesHeroSectionProps {
  locale: string;
}

export default function FamiliesHeroSection({ locale }: FamiliesHeroSectionProps) {
  const t = useTranslations('families.hero');

  return (
    <section className="relative bg-gradient-to-br from-amber-50 via-white to-stone-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-16 md:py-24 lg:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-faxi-brown to-faxi-brown-dark bg-clip-text text-transparent">
            {t('headline')}
          </h1>
          
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            {t('subheadline')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
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

          {/* Core Values */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
              <div className="text-3xl mb-2">🦋</div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{t('value1')}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
              <div className="text-3xl mb-2">💪</div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{t('value2')}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
              <div className="text-3xl mb-2">🤝</div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{t('value3')}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
              <div className="text-3xl mb-2">❤️</div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{t('value4')}</p>
            </div>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-amber-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-stone-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
      </div>
    </section>
  );
}
