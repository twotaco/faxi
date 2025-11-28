'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { Quote, Star } from 'lucide-react';

interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
  demographic: string;
  image?: string;
  index: number;
}

function TestimonialCard({ quote, author, role, demographic, image, index }: TestimonialCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), index * 200);
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [index]);

  return (
    <div
      ref={ref}
      className={`group relative bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
    >
      {/* Quote Icon */}
      <div className="absolute -top-4 left-8">
        <div className="w-12 h-12 bg-faxi-brown rounded-xl flex items-center justify-center shadow-lg transform -rotate-6 group-hover:rotate-0 transition-transform">
          <Quote className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Stars */}
      <div className="flex gap-1 mb-6 pt-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
        ))}
      </div>

      {/* Quote Text */}
      <blockquote className="text-gray-700 dark:text-gray-300 mb-8 leading-relaxed text-lg">
        &ldquo;{quote}&rdquo;
      </blockquote>

      {/* Author Info */}
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="relative w-14 h-14 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 ring-4 ring-faxi-brown/10">
          {image ? (
            <Image
              src={image}
              alt={author}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">
              {author.charAt(0)}
            </div>
          )}
        </div>
        <div>
          <p className="font-bold text-faxi-brown dark:text-white">
            {author}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {role}
          </p>
          <p className="text-xs text-faxi-accent font-medium mt-1">
            {demographic}
          </p>
        </div>
      </div>

      {/* Decorative gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-faxi-brown via-faxi-accent to-faxi-brown-light rounded-b-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

export function TestimonialsSection() {
  const t = useTranslations('home.testimonials');

  const testimonials = [
    {
      key: 'tanaka',
      image: '/images/testimonial-1.jpg',
    },
    {
      key: 'clinic',
      image: '/images/testimonial-2.jpg',
    },
    {
      key: 'family',
      image: null,
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-faxi-accent/5 rounded-full blur-3xl transform -translate-y-1/2" />
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-faxi-brown/5 rounded-full blur-3xl transform -translate-y-1/2" />
      </div>

      {/* Decorative Quote Marks */}
      <div className="absolute top-20 left-10 text-faxi-brown/5 dark:text-white/5">
        <Quote className="w-48 h-48" />
      </div>
      <div className="absolute bottom-20 right-10 text-faxi-brown/5 dark:text-white/5 transform rotate-180">
        <Quote className="w-48 h-48" />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-faxi-brown/10 dark:bg-faxi-brown/20 text-faxi-brown dark:text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Star className="w-4 h-4 fill-current" />
            {t('badge') || 'Testimonials'}
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-faxi-brown dark:text-white mb-6">
            {t('title')}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <TestimonialCard
              key={testimonial.key}
              quote={t(`items.${testimonial.key}.quote`)}
              author={t(`items.${testimonial.key}.author`)}
              role={t(`items.${testimonial.key}.role`)}
              demographic={t(`items.${testimonial.key}.demographic`)}
              image={testimonial.image || undefined}
              index={index}
            />
          ))}
        </div>

        {/* Stats Section */}
        <div className="mt-20 bg-faxi-brown rounded-3xl p-8 md:p-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
            <div>
              <p className="text-4xl md:text-5xl font-bold mb-2">99%</p>
              <p className="text-white/70 text-sm">Customer Satisfaction</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-bold mb-2">10K+</p>
              <p className="text-white/70 text-sm">Faxes Processed</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-bold mb-2">24/7</p>
              <p className="text-white/70 text-sm">Always Available</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-bold mb-2">&lt;5min</p>
              <p className="text-white/70 text-sm">Average Response</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
