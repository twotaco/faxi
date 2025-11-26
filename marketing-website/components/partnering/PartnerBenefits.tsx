import { useTranslations } from 'next-intl';

interface DataInsight {
  category: string;
  description: string;
  value: string;
  icon: string;
}

interface MarketStatistic {
  value: string;
  label: string;
  description: string;
  source: string;
}

export default function PartnerBenefits() {
  const t = useTranslations('partnering');

  const dataInsights: DataInsight[] = [
    {
      category: t('dataInsights.consumerBehavior.category'),
      description: t('dataInsights.consumerBehavior.description'),
      value: t('dataInsights.consumerBehavior.value'),
      icon: '📊',
    },
    {
      category: t('dataInsights.demographics.category'),
      description: t('dataInsights.demographics.description'),
      value: t('dataInsights.demographics.value'),
      icon: '👥',
    },
    {
      category: t('dataInsights.preferences.category'),
      description: t('dataInsights.preferences.description'),
      value: t('dataInsights.preferences.value'),
      icon: '❤️',
    },
    {
      category: t('dataInsights.timing.category'),
      description: t('dataInsights.timing.description'),
      value: t('dataInsights.timing.value'),
      icon: '⏰',
    },
  ];

  const marketStats: MarketStatistic[] = [
    {
      value: '¥2.5T',
      label: t('marketStats.elderlySpending.label'),
      description: t('marketStats.elderlySpending.description'),
      source: t('marketStats.elderlySpending.source'),
    },
    {
      value: '90%',
      label: t('marketStats.faxUsage.label'),
      description: t('marketStats.faxUsage.description'),
      source: t('marketStats.faxUsage.source'),
    },
    {
      value: '9M',
      label: t('marketStats.noDigitalFootprint.label'),
      description: t('marketStats.noDigitalFootprint.description'),
      source: t('marketStats.noDigitalFootprint.source'),
    },
    {
      value: '29%',
      label: t('marketStats.agingPopulation.label'),
      description: t('marketStats.agingPopulation.description'),
      source: t('marketStats.agingPopulation.source'),
    },
  ];

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        {/* Data Insights Section */}
        <div className="mb-16">
          <h2 className="text-4xl font-bold text-center mb-4">{t('dataInsightsTitle')}</h2>
          <p className="text-xl text-gray-600 text-center mb-12">
            {t('dataInsightsSubtitle')}
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dataInsights.map((insight, index) => (
              <div
                key={index}
                className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                <div className="text-4xl mb-3">{insight.icon}</div>
                <h3 className="text-xl font-bold mb-2">{insight.category}</h3>
                <p className="text-sm text-gray-600 mb-3">{insight.description}</p>
                <p className="text-sm font-semibold text-blue-600">{insight.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Market Statistics Section */}
        <div className="mb-16">
          <h2 className="text-4xl font-bold text-center mb-4">{t('marketStatsTitle')}</h2>
          <p className="text-xl text-gray-600 text-center mb-12">
            {t('marketStatsSubtitle')}
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {marketStats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-5xl font-bold text-blue-600 mb-2">{stat.value}</div>
                <div className="text-lg font-semibold mb-2">{stat.label}</div>
                <p className="text-sm text-gray-600 mb-2">{stat.description}</p>
                <p className="text-xs text-gray-400 italic">{stat.source}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Opportunities Section */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-12 text-white">
          <h2 className="text-3xl font-bold text-center mb-8">{t('revenueOpportunities.title')}</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-xl font-bold mb-2">{t('revenueOpportunities.directRevenue.title')}</h3>
              <p className="text-blue-100">{t('revenueOpportunities.directRevenue.description')}</p>
            </div>
            
            <div className="text-center">
              <div className="text-4xl mb-4">📈</div>
              <h3 className="text-xl font-bold mb-2">{t('revenueOpportunities.dataMonetization.title')}</h3>
              <p className="text-blue-100">{t('revenueOpportunities.dataMonetization.description')}</p>
            </div>
            
            <div className="text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="text-xl font-bold mb-2">{t('revenueOpportunities.marketExpansion.title')}</h3>
              <p className="text-blue-100">{t('revenueOpportunities.marketExpansion.description')}</p>
            </div>
          </div>
        </div>

        {/* Testimonials Section (if available) */}
        <div className="mt-16">
          <h2 className="text-3xl font-bold text-center mb-12">{t('partnerTestimonialsTitle')}</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-gray-50 rounded-lg p-6">
              <p className="text-gray-600 italic mb-4">&ldquo;{t('testimonials.healthcare.quote')}&rdquo;</p>
              <div className="flex items-center">
                <div>
                  <p className="font-semibold">{t('testimonials.healthcare.author')}</p>
                  <p className="text-sm text-gray-500">{t('testimonials.healthcare.role')}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6">
              <p className="text-gray-600 italic mb-4">&ldquo;{t('testimonials.ecommerce.quote')}&rdquo;</p>
              <div className="flex items-center">
                <div>
                  <p className="font-semibold">{t('testimonials.ecommerce.author')}</p>
                  <p className="text-sm text-gray-500">{t('testimonials.ecommerce.role')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
