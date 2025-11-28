'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface StoryCardProps {
  icon: string;
  title: string;
  story: string;
  impact: string;
}

function StoryCard({ icon, title, story, impact }: StoryCardProps) {
  return (
    <Card className="h-full hover:shadow-xl transition-shadow">
      <CardHeader>
        <div className="text-5xl mb-4">{icon}</div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{story}</p>
          <div className="p-3 bg-gradient-to-br from-amber-50 to-stone-50 dark:from-amber-900/20 dark:to-stone-900/20 rounded-lg">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-1">Impact:</p>
            <p className="text-sm text-gray-700 dark:text-gray-300">{impact}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface FamiliesUseCasesSectionProps {
  locale: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function FamiliesUseCasesSection({ locale }: FamiliesUseCasesSectionProps) {
  const t = useTranslations('families.stories');

  return (
    <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">
            {t('title')}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          <StoryCard
            icon="🛒"
            title={t('shopping.title')}
            story={t('shopping.story')}
            impact={t('shopping.impact')}
          />
          <StoryCard
            icon="🏥"
            title={t('healthcare.title')}
            story={t('healthcare.story')}
            impact={t('healthcare.impact')}
          />
          <StoryCard
            icon="🌸"
            title={t('hobbies.title')}
            story={t('hobbies.story')}
            impact={t('hobbies.impact')}
          />
        </div>
      </div>
    </section>
  );
}
