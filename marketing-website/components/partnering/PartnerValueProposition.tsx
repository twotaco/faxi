import { useTranslations } from 'next-intl';

interface PartnerType {
  type: string;
  title: string;
  description: string;
  benefits: string[];
  caseStudy?: {
    title: string;
    result: string;
    metric: string;
  };
}

export default function PartnerValueProposition() {
  const t = useTranslations('partnering');

  const partnerTypes: PartnerType[] = [
    {
      type: 'healthcare',
      title: t('partnerTypes.healthcare.title'),
      description: t('partnerTypes.healthcare.description'),
      benefits: [
        t('partnerTypes.healthcare.benefits.0'),
        t('partnerTypes.healthcare.benefits.1'),
        t('partnerTypes.healthcare.benefits.2'),
      ],
      caseStudy: {
        title: t('partnerTypes.healthcare.caseStudy.title'),
        result: t('partnerTypes.healthcare.caseStudy.result'),
        metric: t('partnerTypes.healthcare.caseStudy.metric'),
      },
    },
    {
      type: 'ecommerce',
      title: t('partnerTypes.ecommerce.title'),
      description: t('partnerTypes.ecommerce.description'),
      benefits: [
        t('partnerTypes.ecommerce.benefits.0'),
        t('partnerTypes.ecommerce.benefits.1'),
        t('partnerTypes.ecommerce.benefits.2'),
      ],
    },
    {
      type: 'government',
      title: t('partnerTypes.government.title'),
      description: t('partnerTypes.government.description'),
      benefits: [
        t('partnerTypes.government.benefits.0'),
        t('partnerTypes.government.benefits.1'),
        t('partnerTypes.government.benefits.2'),
      ],
    },
    {
      type: 'advertiser',
      title: t('partnerTypes.advertiser.title'),
      description: t('partnerTypes.advertiser.description'),
      benefits: [
        t('partnerTypes.advertiser.benefits.0'),
        t('partnerTypes.advertiser.benefits.1'),
        t('partnerTypes.advertiser.benefits.2'),
      ],
    },
    {
      type: 'dataBuyer',
      title: t('partnerTypes.dataBuyer.title'),
      description: t('partnerTypes.dataBuyer.description'),
      benefits: [
        t('partnerTypes.dataBuyer.benefits.0'),
        t('partnerTypes.dataBuyer.benefits.1'),
        t('partnerTypes.dataBuyer.benefits.2'),
      ],
    },
  ];

  return (
    <section className="py-16 bg-gradient-to-b from-white to-gray-50">
      <div className="container mx-auto px-4">
        {/* Market Opportunity Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">{t('marketOpportunity.title')}</h2>
          <p className="text-xl text-gray-600 mb-8">{t('marketOpportunity.subtitle')}</p>
          <div className="flex flex-wrap justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-5xl font-bold text-faxi-brown mb-2">10M+</div>
              <div className="text-gray-600">{t('marketOpportunity.stats.faxUsers')}</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-faxi-brown mb-2">36M</div>
              <div className="text-gray-600">{t('marketOpportunity.stats.elderlyPopulation')}</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-bold text-faxi-brown mb-2">25%</div>
              <div className="text-gray-600">{t('marketOpportunity.stats.offlineSeniors')}</div>
            </div>
          </div>
        </div>

        {/* Partner Types */}
        <div className="mb-12">
          <h3 className="text-3xl font-bold text-center mb-12">{t('partnerTypesTitle')}</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {partnerTypes.map((partner) => (
              <div
                key={partner.type}
                className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                <h4 className="text-2xl font-bold mb-3 text-faxi-brown">{partner.title}</h4>
                <p className="text-gray-600 mb-4">{partner.description}</p>
                
                <div className="mb-4">
                  <h5 className="font-semibold mb-2">{t('benefits')}</h5>
                  <ul className="space-y-2">
                    {partner.benefits.map((benefit, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-amber-700 mr-2">✓</span>
                        <span className="text-sm text-gray-700">{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {partner.caseStudy && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h5 className="font-semibold mb-2 text-sm text-gray-500">
                      {t('caseStudy')}
                    </h5>
                    <p className="text-sm font-medium mb-1">{partner.caseStudy.title}</p>
                    <p className="text-sm text-gray-600 mb-2">{partner.caseStudy.result}</p>
                    <p className="text-lg font-bold text-faxi-brown">{partner.caseStudy.metric}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
