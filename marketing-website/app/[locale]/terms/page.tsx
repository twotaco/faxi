import { useTranslations } from 'next-intl';

export default function TermsPage() {
  const t = useTranslations('navigation');

  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-8">{t('terms')}</h1>
      <p className="text-lg">Terms of service - content to be added</p>
    </div>
  );
}
