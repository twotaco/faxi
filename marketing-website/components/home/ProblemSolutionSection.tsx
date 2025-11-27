'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

interface StatCardProps {
  value: string;
  label: string;
  source: string;
}

function StatCard({ value, label, source }: StatCardProps) {
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
    <div ref={ref} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
      <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
        {displayValue}
      </div>
      <div className="text-gray-700 dark:text-gray-300 font-medium mb-1">
        {label}
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {source}
      </div>
    </div>
  );
}

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-300">
        {description}
      </p>
    </div>
  );
}

export function ProblemSolutionSection() {
  const t = useTranslations('home');

  return (
    <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        {/* Problem Section */}
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-6 text-gray-900 dark:text-white">
            {t('problem.title')}
          </h2>
          <p className="text-lg text-center text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto">
            {t('problem.description')}
          </p>

          {/* Pain Points Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <FeatureCard
              icon="😰"
              title={t('problem.painPoints.complexity.title')}
              description={t('problem.painPoints.complexity.description')}
            />
            <FeatureCard
              icon="🌐"
              title={t('problem.painPoints.isolation.title')}
              description={t('problem.painPoints.isolation.description')}
            />
            <FeatureCard
              icon="💪"
              title={t('problem.painPoints.independence.title')}
              description={t('problem.painPoints.independence.description')}
            />
            <FeatureCard
              icon="📠"
              title={t('problem.painPoints.trust.title')}
              description={t('problem.painPoints.trust.description')}
            />
          </div>
        </div>

        {/* Solution Section */}
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-6 text-gray-900 dark:text-white">
            {t('solution.title')}
          </h2>
          <p className="text-lg text-center text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto">
            {t('solution.description')}
          </p>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <FeatureCard
              icon="✅"
              title={t('solution.features.noLearning.title')}
              description={t('solution.features.noLearning.description')}
            />
            <FeatureCard
              icon="⚡"
              title={t('solution.features.instantResponse.title')}
              description={t('solution.features.instantResponse.description')}
            />
            <FeatureCard
              icon="🔗"
              title={t('solution.features.multiService.title')}
              description={t('solution.features.multiService.description')}
            />
            <FeatureCard
              icon="🕐"
              title={t('solution.features.alwaysWorking.title')}
              description={t('solution.features.alwaysWorking.description')}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
