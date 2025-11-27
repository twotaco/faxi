import { useTranslations } from 'next-intl';

export default function AboutPage() {
  const t = useTranslations('about');

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        {/* Hero Section */}
        <div className="mb-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {t('hero.title')}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            {t('hero.subtitle')}
          </p>
        </div>

        {/* Vision Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-6">{t('vision.title')}</h2>
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
            {t('vision.description')}
          </p>
        </section>

        {/* Market Opportunity */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8">{t('market.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Market Stats */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                {t('market.stats.faxMachines.value')}
              </div>
              <div className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                {t('market.stats.faxMachines.label')}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t('market.stats.faxMachines.source')}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                {t('market.stats.offlineSeniors.value')}
              </div>
              <div className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                {t('market.stats.offlineSeniors.label')}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t('market.stats.offlineSeniors.source')}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                {t('market.stats.elderlyPopulation.value')}
              </div>
              <div className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                {t('market.stats.elderlyPopulation.label')}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t('market.stats.elderlyPopulation.source')}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                {t('market.stats.noDigitalFootprint.value')}
              </div>
              <div className="text-gray-700 dark:text-gray-300 font-medium mb-1">
                {t('market.stats.noDigitalFootprint.label')}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t('market.stats.noDigitalFootprint.source')}
              </div>
            </div>
          </div>
        </section>

        {/* Technology */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-6">{t('technology.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-semibold mb-2">{t('technology.ai.title')}</h3>
              <p className="text-gray-600 dark:text-gray-300">{t('technology.ai.description')}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-semibold mb-2">{t('technology.processing.title')}</h3>
              <p className="text-gray-600 dark:text-gray-300">{t('technology.processing.description')}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <div className="text-4xl mb-4">🔌</div>
              <h3 className="text-xl font-semibold mb-2">{t('technology.integration.title')}</h3>
              <p className="text-gray-600 dark:text-gray-300">{t('technology.integration.description')}</p>
            </div>
          </div>
        </section>

        {/* Business Model */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-6">{t('business.title')}</h2>
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <h3 className="text-xl font-semibold mb-2">{t('business.b2c.title')}</h3>
              <p className="text-gray-600 dark:text-gray-300">{t('business.b2c.description')}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <h3 className="text-xl font-semibold mb-2">{t('business.b2b.title')}</h3>
              <p className="text-gray-600 dark:text-gray-300">{t('business.b2b.description')}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <h3 className="text-xl font-semibold mb-2">{t('business.data.title')}</h3>
              <p className="text-gray-600 dark:text-gray-300">{t('business.data.description')}</p>
            </div>
          </div>
        </section>

        {/* Team/Contact CTA */}
        <section className="text-center bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-12 text-white">
          <h2 className="text-3xl font-bold mb-4">{t('cta.title')}</h2>
          <p className="text-xl mb-8">{t('cta.description')}</p>
          <a
            href={`mailto:${t('cta.email')}`}
            className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            {t('cta.button')}
          </a>
        </section>
      </div>
    </div>
  );
}
