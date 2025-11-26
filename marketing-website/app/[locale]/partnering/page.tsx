import { useTranslations } from 'next-intl';
import PartnerValueProposition from '@/components/partnering/PartnerValueProposition';
import PartnerBenefits from '@/components/partnering/PartnerBenefits';
import PartnerContactForm from '@/components/partnering/PartnerContactForm';
import { CTABanner } from '@/components/ui/cta-banner';

export default function PartneringPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations('partnering');

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6">{t('hero.title')}</h1>
          <p className="text-2xl mb-8">{t('hero.subtitle')}</p>
          <p className="text-xl text-blue-100 max-w-3xl mx-auto">{t('hero.description')}</p>
        </div>
      </section>

      {/* Partner Value Proposition */}
      <PartnerValueProposition />

      {/* Partner Benefits */}
      <PartnerBenefits />

      {/* Contact Form */}
      <PartnerContactForm />

      {/* CTA Banner */}
      <CTABanner audience="partners" locale={locale} variant="compact" />
    </div>
  );
}
