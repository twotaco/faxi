'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';

interface TestimonialCardProps {
  quote: string;
  author: string;
  relationship: string;
  location: string;
}

function TestimonialCard({ quote, author, relationship, location }: TestimonialCardProps) {
  return (
    <Card className="h-full">
      <CardContent className="pt-6">
        <div className="flex flex-col h-full">
          <div className="text-4xl text-amber-700 dark:text-amber-400 mb-4">
            &ldquo;
          </div>
          
          <p className="text-gray-700 dark:text-gray-300 mb-6 flex-grow italic">
            {quote}
          </p>
          
          <div className="border-t pt-4">
            <p className="font-semibold text-gray-900 dark:text-white">
              {author}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {relationship}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {location}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FamiliesTestimonialsSection() {
  const t = useTranslations('families.testimonials');

  const testimonials = ['kenji', 'yuki', 'hiroshi'];

  return (
    <section className="py-16 md:py-24 bg-white dark:bg-gray-800">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">
            {t('title')}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {testimonials.map((key) => (
            <TestimonialCard
              key={key}
              quote={t(`items.${key}.quote`)}
              author={t(`items.${key}.author`)}
              relationship={t(`items.${key}.relationship`)}
              location={t(`items.${key}.location`)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
