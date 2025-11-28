'use client';

import { useTranslations } from 'next-intl';

export default function FamiliesTimeSavingsSection() {
  const t = useTranslations('families.testimonials');

  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-amber-50 to-stone-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">
            {t('title')}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Parent Testimonial */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <div className="text-5xl mb-4">👵</div>
            <blockquote className="text-lg text-gray-700 dark:text-gray-300 mb-6 italic">
              &ldquo;{t('parent.quote')}&rdquo;
            </blockquote>
            <div className="border-t pt-4">
              <p className="font-semibold text-gray-900 dark:text-white">{t('parent.name')}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('parent.details')}</p>
            </div>
          </div>

          {/* Family Member Testimonial */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <div className="text-5xl mb-4">👨‍👩‍👧</div>
            <blockquote className="text-lg text-gray-700 dark:text-gray-300 mb-6 italic">
              &ldquo;{t('family.quote')}&rdquo;
            </blockquote>
            <div className="border-t pt-4">
              <p className="font-semibold text-gray-900 dark:text-white">{t('family.name')}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('family.details')}</p>
            </div>
          </div>
        </div>

        {/* Impact Stats */}
        <div className="mt-12 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
            <div className="text-3xl font-bold text-faxi-brown dark:text-amber-400 mb-2">
              {t('stats.independence')}
            </div>
            <div className="text-gray-600 dark:text-gray-300">
              {t('stats.independenceLabel')}
            </div>
          </div>

          <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
            <div className="text-3xl font-bold text-amber-700 dark:text-amber-400 mb-2">
              {t('stats.satisfaction')}
            </div>
            <div className="text-gray-600 dark:text-gray-300">
              {t('stats.satisfactionLabel')}
            </div>
          </div>

          <div className="text-center p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
            <div className="text-3xl font-bold text-stone-600 dark:text-stone-400 mb-2">
              {t('stats.connection')}
            </div>
            <div className="text-gray-600 dark:text-gray-300">
              {t('stats.connectionLabel')}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
