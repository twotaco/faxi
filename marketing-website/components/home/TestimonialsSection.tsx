'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';

interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
  demographic: string;
}

function TestimonialCard({ quote, author, role, demographic }: TestimonialCardProps) {
  return (
    <Card className="h-full">
      <CardContent className="pt-6">
        <div className="flex flex-col h-full">
          {/* Quote Icon */}
          <div className="text-4xl text-blue-600 dark:text-blue-400 mb-4">
            &ldquo;
          </div>
          
          {/* Quote Text */}
          <p className="text-gray-700 dark:text-gray-300 mb-6 flex-grow italic">
            {quote}
          </p>
          
          {/* Author Info */}
          <div className="border-t pt-4">
            <p className="font-semibold text-gray-900 dark:text-white">
              {author}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {role}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {demographic}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TestimonialsSection() {
  const t = useTranslations('home.testimonials');

  const testimonials = [
    {
      key: 'tanaka',
    },
    {
      key: 'clinic',
    },
    {
      key: 'family',
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-900">
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
          {testimonials.map((testimonial) => (
            <TestimonialCard
              key={testimonial.key}
              quote={t(`items.${testimonial.key}.quote`)}
              author={t(`items.${testimonial.key}.author`)}
              role={t(`items.${testimonial.key}.role`)}
              demographic={t(`items.${testimonial.key}.demographic`)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
