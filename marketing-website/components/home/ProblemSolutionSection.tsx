'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Globe, Heart, Printer, CheckCircle, Zap, Link2, Clock } from 'lucide-react';

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  variant: 'problem' | 'solution';
  delay?: number;
}

function FeatureCard({ icon, title, description, variant, delay = 0 }: FeatureCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
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
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`group relative bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-500 border border-gray-100 dark:border-gray-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      {/* Icon */}
      <div
        className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${
          variant === 'problem'
            ? 'bg-stone-100 dark:bg-stone-900/20 text-stone-600'
            : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700'
        }`}
      >
        {icon}
      </div>

      {/* Content */}
      <h3 className="text-lg font-semibold mb-2 text-faxi-brown dark:text-white">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
        {description}
      </p>

      {/* Decorative corner */}
      <div
        className={`absolute top-0 right-0 w-20 h-20 rounded-bl-[100px] transition-opacity opacity-0 group-hover:opacity-100 ${
          variant === 'problem' ? 'bg-stone-50' : 'bg-amber-50'
        }`}
      />
    </div>
  );
}

export function ProblemSolutionSection() {
  const t = useTranslations('home');

  const problemIcons = [
    <AlertTriangle key="complexity" className="w-7 h-7" />,
    <Globe key="isolation" className="w-7 h-7" />,
    <Heart key="independence" className="w-7 h-7" />,
    <Printer key="trust" className="w-7 h-7" />,
  ];

  const solutionIcons = [
    <CheckCircle key="noLearning" className="w-7 h-7" />,
    <Zap key="instantResponse" className="w-7 h-7" />,
    <Link2 key="multiService" className="w-7 h-7" />,
    <Clock key="alwaysWorking" className="w-7 h-7" />,
  ];

  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Problem Section */}
        <div className="mb-24">
          {/* Section Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-stone-100 dark:bg-stone-900/20 text-stone-600 dark:text-stone-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <AlertTriangle className="w-4 h-4" />
              {t('problem.badge') || 'The Challenge'}
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-faxi-brown dark:text-white mb-6">
              {t('problem.title')}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
              {t('problem.description')}
            </p>
          </div>

          {/* Problem Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {['complexity', 'isolation', 'independence', 'trust'].map((key, index) => (
              <FeatureCard
                key={key}
                icon={problemIcons[index]}
                title={t(`problem.painPoints.${key}.title`)}
                description={t(`problem.painPoints.${key}.description`)}
                variant="problem"
                delay={index * 100}
              />
            ))}
          </div>
        </div>

        {/* Divider with Arrow */}
        <div className="flex items-center justify-center mb-24">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
          <div className="mx-8 w-16 h-16 bg-faxi-brown rounded-full flex items-center justify-center shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent" />
        </div>

        {/* Solution Section */}
        <div>
          {/* Section Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <CheckCircle className="w-4 h-4" />
              {t('solution.badge') || 'The Solution'}
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-faxi-brown dark:text-white mb-6">
              {t('solution.title')}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
              {t('solution.description')}
            </p>
          </div>

          {/* Solution Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {['noLearning', 'instantResponse', 'multiService', 'alwaysWorking'].map((key, index) => (
              <FeatureCard
                key={key}
                icon={solutionIcons[index]}
                title={t(`solution.features.${key}.title`)}
                description={t(`solution.features.${key}.description`)}
                variant="solution"
                delay={index * 100}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
