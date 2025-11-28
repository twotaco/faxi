'use client';

import { useTranslations } from 'next-intl';

interface UseCaseDetailCardProps {
  useCaseKey: string;
  icon: string;
}

export default function UseCaseDetailCard({ useCaseKey, icon }: UseCaseDetailCardProps) {
  const t = useTranslations(`service.useCases.${useCaseKey}`);
  const tCommon = useTranslations('service.useCases');

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 border border-gray-100">
      <div className="p-8">
        {/* Icon and Title */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-3xl">
            {icon}
          </div>
          <div>
            <h3 className="text-2xl font-bold text-faxi-brown">{t('title')}</h3>
            <p className="text-amber-700 font-medium">{t('tagline')}</p>
          </div>
        </div>

        {/* Story/Scenario */}
        <div className="mb-6">
          <p className="text-gray-700 text-lg leading-relaxed">
            {t('story')}
          </p>
        </div>

        {/* How it works - simple steps */}
        <div className="bg-gradient-to-br from-amber-50 to-stone-50 rounded-xl p-6 mb-6">
          <h4 className="font-semibold text-faxi-brown mb-4">{tCommon('howItWorks')}</h4>
          <ol className="space-y-3">
            {[0, 1, 2].map((index) => {
              try {
                const step = t(`steps.${index}`);
                return (
                  <li key={index} className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-faxi-brown text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {index + 1}
                    </span>
                    <span className="text-gray-700">{step}</span>
                  </li>
                );
              } catch {
                return null;
              }
            })}
          </ol>
        </div>

        {/* Testimonial or highlight */}
        <div className="border-l-4 border-amber-400 pl-4">
          <p className="text-gray-600 italic">&ldquo;{t('highlight')}&rdquo;</p>
        </div>
      </div>
    </div>
  );
}
