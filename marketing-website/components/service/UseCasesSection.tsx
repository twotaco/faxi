'use client';

import { useTranslations } from 'next-intl';
import UseCaseDetailCard from './UseCaseDetailCard';

export default function UseCasesSection() {
  const t = useTranslations('service.useCases');

  const useCases = [
    { key: 'healthcare', icon: '🏥' },
    { key: 'shopping', icon: '🛒' },
    { key: 'government', icon: '🏛️' },
    { key: 'payment', icon: '💳' },
    { key: 'aiChat', icon: '💬' },
  ];

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('title')}</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-7xl mx-auto">
          {useCases.map((useCase) => (
            <UseCaseDetailCard
              key={useCase.key}
              useCaseKey={useCase.key}
              icon={useCase.icon}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
