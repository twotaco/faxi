'use client';

import { useTranslations } from 'next-intl';

interface ChallengeCardProps {
  icon: string;
  title: string;
  description: string;
}

function ChallengeCard({ icon, title, description }: ChallengeCardProps) {
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

export default function FamiliesProblemSection() {
  const t = useTranslations('families.challenge');

  return (
    <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4">
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-6 text-gray-900 dark:text-white">
            {t('title')}
          </h2>
          <p className="text-lg text-center text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto">
            {t('description')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <ChallengeCard
              icon="🚧"
              title={t('challenges.digitalBarrier.title')}
              description={t('challenges.digitalBarrier.description')}
            />
            <ChallengeCard
              icon="🏝️"
              title={t('challenges.isolation.title')}
              description={t('challenges.isolation.description')}
            />
            <ChallengeCard
              icon="🤲"
              title={t('challenges.dependence.title')}
              description={t('challenges.dependence.description')}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
