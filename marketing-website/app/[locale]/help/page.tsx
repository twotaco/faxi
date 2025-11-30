import { getTranslations } from 'next-intl/server';
import { HelpHero } from '@/components/help/HelpHero';
import { GettingStarted } from '@/components/help/GettingStarted';
import Instructions from '@/components/help/Instructions';
import FAQAccordion from '@/components/help/FAQAccordion';

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ locale: string }> 
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'help' });
  
  return {
    title: t('meta.title'),
    description: t('meta.description'),
  };
}

export default async function HelpPage({ 
  params 
}: { 
  params: Promise<{ locale: string }> 
}) {
  const { locale } = await params;
  
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-amber-50">
      <HelpHero locale={locale} />
      <GettingStarted locale={locale} />
      <Instructions />
      <FAQAccordion />
      
      {/* Additional sections will be added in subsequent tasks */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Placeholder sections for future components */}
          <section id="troubleshooting" className="mb-12">
            <h2 className="text-3xl font-bold text-faxi-brown mb-4">
              {locale === 'ja' ? 'トラブルシューティング' : 'Troubleshooting'}
            </h2>
            <p className="text-gray-700">
              {locale === 'ja' 
                ? 'このセクションは今後追加されます。' 
                : 'This section will be added in future tasks.'}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
