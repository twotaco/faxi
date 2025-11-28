'use client';

import { useTranslations } from 'next-intl';

interface EmpowermentCardProps {
  icon: string;
  title: string;
  description: string;
}

function EmpowermentCard({ icon, title, description }: EmpowermentCardProps) {
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

export default function FamiliesSolutionSection() {
  const t = useTranslations('families.empowerment');

  return (
    <section className="py-16 md:py-24 bg-white dark:bg-gray-800">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-6 text-gray-900 dark:text-white">
          {t('title')}
        </h2>
        <p className="text-lg text-center text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto">
          {t('description')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          <EmpowermentCard
            icon="🦋"
            title={t('benefits.independence.title')}
            description={t('benefits.independence.description')}
          />
          <EmpowermentCard
            icon="💪"
            title={t('benefits.confidence.title')}
            description={t('benefits.confidence.description')}
          />
          <EmpowermentCard
            icon="🌐"
            title={t('benefits.inclusion.title')}
            description={t('benefits.inclusion.description')}
          />
          <EmpowermentCard
            icon="🤝"
            title={t('benefits.connection.title')}
            description={t('benefits.connection.description')}
          />
        </div>

        {/* Family Benefits */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-center mb-8 text-gray-900 dark:text-white">
            {t('familyBenefits.title')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-700 dark:to-gray-600 rounded-lg p-6">
              <div className="text-3xl mb-3">❤️</div>
              <h4 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                {t('familyBenefits.peace.title')}
              </h4>
              <p className="text-gray-600 dark:text-gray-300">
                {t('familyBenefits.peace.description')}
              </p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-700 dark:to-gray-600 rounded-lg p-6">
              <div className="text-3xl mb-3">🌉</div>
              <h4 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
                {t('familyBenefits.bridge.title')}
              </h4>
              <p className="text-gray-600 dark:text-gray-300">
                {t('familyBenefits.bridge.description')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
