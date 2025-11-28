import { useTranslations } from 'next-intl';
import ServiceOverview from '@/components/service/ServiceOverview';
import UseCasesSection from '@/components/service/UseCasesSection';
import FAQSection from '@/components/service/FAQSection';
import { CTABanner } from '@/components/ui/cta-banner';

export default function ServicePage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations('service');

  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <section className="bg-gradient-to-r from-faxi-brown to-faxi-brown-dark text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('title')}</h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto opacity-90">
            {t('subtitle')}
          </p>
        </div>
      </section>

      {/* Service Overview */}
      <ServiceOverview />

      {/* Use Cases */}
      <UseCasesSection />

      {/* FAQ */}
      <FAQSection />

      {/* CTA Banner */}
      <CTABanner audience="families" locale={locale} />
    </div>
  );
}
