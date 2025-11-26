'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

interface ImpactStatisticProps {
  value: string;
  label: string;
  description: string;
  source: string;
}

function ImpactStatistic({ value, label, description, source }: ImpactStatisticProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [displayValue, setDisplayValue] = useState('0');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  useEffect(() => {
    if (isVisible) {
      // Animate the number if it contains digits
      const numMatch = value.match(/\d+/);
      if (numMatch) {
        const targetNum = parseInt(numMatch[0]);
        const duration = 2000; // 2 seconds
        const steps = 60;
        const increment = targetNum / steps;
        let current = 0;
        
        const timer = setInterval(() => {
          current += increment;
          if (current >= targetNum) {
            setDisplayValue(value);
            clearInterval(timer);
          } else {
            setDisplayValue(value.replace(/\d+/, Math.floor(current).toString()));
          }
        }, duration / steps);

        return () => clearInterval(timer);
      } else {
        setDisplayValue(value);
      }
    }
  }, [isVisible, value]);

  return (
    <div ref={ref} className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-8 shadow-lg hover:shadow-xl transition-all">
      <div className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 mb-3">
        {displayValue}
      </div>
      <div className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        {label}
      </div>
      <p className="text-gray-600 dark:text-gray-300 mb-3 text-sm">
        {description}
      </p>
      <div className="text-xs text-gray-500 dark:text-gray-400 italic border-t border-gray-200 dark:border-gray-600 pt-2">
        Source: {source}
      </div>
    </div>
  );
}

export function ImpactStatistics() {
  const t = useTranslations('home.impact');

  return (
    <section className="py-16 md:py-24 bg-white dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
          {t('title')}
        </h2>
        <p className="text-lg text-center text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto">
          {t('subtitle')}
        </p>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <ImpactStatistic
            value={t('stats.faxUsers.value')}
            label={t('stats.faxUsers.label')}
            description={t('stats.faxUsers.description')}
            source={t('stats.faxUsers.source')}
          />
          <ImpactStatistic
            value={t('stats.offlineSeniors.value')}
            label={t('stats.offlineSeniors.label')}
            description={t('stats.offlineSeniors.description')}
            source={t('stats.offlineSeniors.source')}
          />
          <ImpactStatistic
            value={t('stats.elderlyPopulation.value')}
            label={t('stats.elderlyPopulation.label')}
            description={t('stats.elderlyPopulation.description')}
            source={t('stats.elderlyPopulation.source')}
          />
          <ImpactStatistic
            value={t('stats.aiAccuracy.value')}
            label={t('stats.aiAccuracy.label')}
            description={t('stats.aiAccuracy.description')}
            source={t('stats.aiAccuracy.source')}
          />
          <ImpactStatistic
            value={t('stats.processingTime.value')}
            label={t('stats.processingTime.label')}
            description={t('stats.processingTime.description')}
            source={t('stats.processingTime.source')}
          />
          <ImpactStatistic
            value={t('stats.useCases.value')}
            label={t('stats.useCases.label')}
            description={t('stats.useCases.description')}
            source={t('stats.useCases.source')}
          />
        </div>
      </div>
    </section>
  );
}
