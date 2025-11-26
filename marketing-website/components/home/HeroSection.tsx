'use client';

import { useTranslations } from 'next-intl';
import { CTAButton } from '@/components/ui/cta-button';
import { useState } from 'react';

type Audience = 'families' | 'partners' | 'investors';

interface HeroSectionProps {
  locale: string;
}

export function HeroSection({ locale }: HeroSectionProps) {
  const t = useTranslations('home.hero');
  const [audience, setAudience] = useState<Audience>('families');

  const getPrimaryHref = () => {
    switch (audience) {
      case 'families':
        return `/${locale}/service`;
      case 'partners':
        return `/${locale}/partnering`;
      case 'investors':
        return `/${locale}/tech`;
    }
  };

  return (
    <section className="relative bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-16 md:py-24 lg:py-32">
        {/* Audience Selector */}
        <div className="flex justify-center mb-8 gap-2 flex-wrap" role="group" aria-label="Select audience type">
          <button
            onClick={() => setAudience('families')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              audience === 'families'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
            aria-pressed={audience === 'families'}
            aria-label={locale === 'ja' ? '家族向けコンテンツを表示' : 'Show content for families'}
          >
            {locale === 'ja' ? '家族向け' : 'For Families'}
          </button>
          <button
            onClick={() => setAudience('partners')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              audience === 'partners'
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
            aria-pressed={audience === 'partners'}
            aria-label={locale === 'ja' ? 'パートナー向けコンテンツを表示' : 'Show content for partners'}
          >
            {locale === 'ja' ? 'パートナー向け' : 'For Partners'}
          </button>
          <button
            onClick={() => setAudience('investors')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              audience === 'investors'
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
            }`}
            aria-pressed={audience === 'investors'}
            aria-label={locale === 'ja' ? '投資家向けコンテンツを表示' : 'Show content for investors'}
          >
            {locale === 'ja' ? '投資家向け' : 'For Investors'}
          </button>
        </div>

        {/* Hero Content */}
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {t(`${audience}.headline`)}
          </h1>
          
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            {t(`${audience}.subheadline`)}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <CTAButton
              href={getPrimaryHref()}
              audience={audience}
              priority="primary"
              className="w-full sm:w-auto"
            >
              {t(`${audience}.ctaPrimary`)}
            </CTAButton>
            <CTAButton
              href={`/${locale}/demo`}
              audience={audience}
              priority="secondary"
              className="w-full sm:w-auto"
            >
              {t(`${audience}.ctaSecondary`)}
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
