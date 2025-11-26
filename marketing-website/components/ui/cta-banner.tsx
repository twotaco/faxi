import { useTranslations } from 'next-intl';
import { CTASection, CTAConfig } from './cta-section';

interface CTABannerProps {
  audience?: 'families' | 'partners' | 'investors';
  locale: string;
  variant?: 'default' | 'compact';
}

export function CTABanner({ audience = 'families', locale, variant = 'default' }: CTABannerProps) {
  const t = useTranslations('cta');
  
  const getCTAs = (): CTAConfig[] => {
    switch (audience) {
      case 'families':
        return [
          { text: t('families.signUp'), href: `/${locale}/service#signup`, priority: 'primary' },
          { text: t('general.tryDemo'), href: `/${locale}/demo`, priority: 'secondary' },
        ];
      case 'partners':
        return [
          { text: t('partners.partnerWithUs'), href: `/${locale}/partnering#contact`, priority: 'primary' },
          { text: t('partners.requestDemo'), href: `/${locale}/demo`, priority: 'secondary' },
        ];
      case 'investors':
        return [
          { text: t('investors.viewGithub'), href: 'https://github.com/faxi-ai/faxi', priority: 'primary', external: true },
          { text: t('investors.technicalDetails'), href: `/${locale}/tech`, priority: 'secondary' },
        ];
    }
  };

  const getTitle = () => {
    switch (audience) {
      case 'families':
        return locale === 'ja' ? 'Faxiを始めましょう' : 'Get Started with Faxi';
      case 'partners':
        return locale === 'ja' ? '提携について' : 'Partner With Us';
      case 'investors':
        return locale === 'ja' ? '技術詳細を見る' : 'Explore the Technology';
    }
  };

  const getDescription = () => {
    switch (audience) {
      case 'families':
        return locale === 'ja' 
          ? 'ご両親のFAXをインターネットに接続して、オンラインサービスへのアクセスを簡単にしましょう。'
          : 'Connect your parents\' fax machine to the internet and make online services accessible.';
      case 'partners':
        return locale === 'ja'
          ? '1000万人の高齢者市場にアクセスし、サービスのアクセシビリティを向上させましょう。'
          : 'Access the 10M+ elderly market and improve service accessibility.';
      case 'investors':
        return locale === 'ja'
          ? 'オープンソースコードと技術ドキュメントをご覧ください。'
          : 'Explore our open-source code and technical documentation.';
    }
  };

  if (variant === 'compact') {
    return (
      <section className="py-12 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-white text-center md:text-left">
              <h3 className="text-2xl font-bold mb-2">{getTitle()}</h3>
            </div>
            <CTASection audience={audience} ctas={getCTAs()} orientation="horizontal" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{getTitle()}</h2>
          <p className="text-lg text-muted-foreground mb-8">{getDescription()}</p>
          <CTASection audience={audience} ctas={getCTAs()} orientation="horizontal" className="justify-center" />
        </div>
      </div>
    </section>
  );
}
