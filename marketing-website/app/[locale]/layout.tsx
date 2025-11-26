import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales } from '@/i18n';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }) {
  return {
    title: 'Faxi - Connecting Fax to the Internet',
    description: 'Bridging the digital divide with AI-powered fax technology',
    openGraph: {
      title: 'Faxi - Connecting Fax to the Internet',
      description: 'Bridging the digital divide with AI-powered fax technology',
      type: 'website',
      locale: locale,
    },
  };
}

export default async function LocaleLayout({
  children,
  params: { locale }
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  // Validate locale
  if (!locales.includes(locale as 'en' | 'ja')) {
    notFound();
  }

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <div className="flex flex-col min-h-screen">
        <Header locale={locale} />
        <main className="flex-1">
          {children}
        </main>
        <Footer locale={locale} />
      </div>
    </NextIntlClientProvider>
  );
}
