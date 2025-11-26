'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useState } from 'react';

interface UseCaseCardProps {
  icon: string;
  title: string;
  demographic: string;
  problem: string;
  solution: string;
  locale: string;
}

function UseCaseCard({ icon, title, demographic, problem, solution, locale }: UseCaseCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const t = useTranslations('home.useCases');

  return (
    <Card 
      className="transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardHeader>
        <div className={`text-5xl mb-4 transition-transform duration-300 ${isHovered ? 'scale-110' : ''}`}>
          {icon}
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className="text-sm font-medium text-blue-600 dark:text-blue-400">
          {demographic}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              {locale === 'ja' ? '課題:' : 'Problem:'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {problem}
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              {locale === 'ja' ? '解決策:' : 'Solution:'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {solution}
            </p>
          </div>
          <Button asChild variant="link" className="p-0 h-auto">
            <Link href={`/${locale}/service`}>
              {t('viewDetails')} →
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface UseCaseSectionProps {
  locale: string;
}

export function UseCaseSection({ locale }: UseCaseSectionProps) {
  const t = useTranslations('home.useCases');

  const useCases = [
    {
      icon: '🏥',
      key: 'healthcare',
    },
    {
      icon: '🛒',
      key: 'shopping',
    },
    {
      icon: '🏛️',
      key: 'government',
    },
    {
      icon: '💬',
      key: 'aiChat',
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-white dark:bg-gray-800">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">
            {t('title')}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {useCases.map((useCase) => (
            <UseCaseCard
              key={useCase.key}
              icon={useCase.icon}
              title={t(`${useCase.key}.title`)}
              demographic={t(`${useCase.key}.demographic`)}
              problem={t(`${useCase.key}.problem`)}
              solution={t(`${useCase.key}.solution`)}
              locale={locale}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
