'use client';

import { useTranslations } from 'next-intl';
import { useState, useRef, useEffect } from 'react';
import { ArrowRight, Stethoscope, ShoppingCart, Building2, Mail, Play } from 'lucide-react';
import { VideoModal } from './VideoModal';

interface UseCaseCardProps {
  icon: React.ReactNode;
  title: string;
  demographic: string;
  problem: string;
  solution: string;
  locale: string;
  index: number;
  color: string;
  videoSrc: string;
  onViewDemo: () => void;
}

function UseCaseCard({ icon, title, demographic, problem, solution, locale, index, color, onViewDemo }: UseCaseCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), index * 150);
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
      className={`group relative bg-white dark:bg-gray-800 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Top Colored Bar */}
      <div className={`h-2 ${color}`} />

      {/* Content */}
      <div className="p-8">
        {/* Icon */}
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300 ${
            isHovered ? 'scale-110 rotate-3' : ''
          } ${color} text-white`}
        >
          {icon}
        </div>

        {/* Title & Demographic */}
        <h3 className="text-xl font-bold text-faxi-brown dark:text-white mb-2">
          {title}
        </h3>
        <p className={`text-sm font-medium mb-6 ${color.replace('bg-', 'text-').replace('-500', '-600')}`}>
          {demographic}
        </p>

        {/* Problem & Solution */}
        <div className="space-y-4">
          <div className="bg-stone-100 dark:bg-stone-900/20 rounded-xl p-4">
            <p className="text-xs font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-wider mb-1">
              {locale === 'ja' ? '課題' : 'Challenge'}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {problem}
            </p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">
              {locale === 'ja' ? '解決策' : 'Solution'}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {solution}
            </p>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onViewDemo}
          className="group/link inline-flex items-center gap-2 mt-6 text-faxi-brown dark:text-faxi-accent font-semibold hover:gap-3 transition-all"
        >
          <Play className="w-4 h-4" />
          {locale === 'ja' ? 'デモを見る' : 'View Demo'}
          <ArrowRight className="w-4 h-4 transition-transform group-hover/link:translate-x-1" />
        </button>
      </div>

      {/* Hover Gradient Overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}
      />
    </div>
  );
}

interface UseCaseSectionProps {
  locale: string;
}

export function UseCaseSection({ locale }: UseCaseSectionProps) {
  const t = useTranslations('home.useCases');
  const [selectedVideo, setSelectedVideo] = useState<{ src: string; title: string } | null>(null);

  const useCases = [
    {
      icon: <Stethoscope className="w-8 h-8" />,
      key: 'healthcare',
      color: 'bg-faxi-brown',
      videoSrc: '/videos/muted/appointment1-muted.mp4',
    },
    {
      icon: <ShoppingCart className="w-8 h-8" />,
      key: 'shopping',
      color: 'bg-amber-600',
      videoSrc: '/videos/muted/ecomm1-muted.mp4',
    },
    {
      icon: <Building2 className="w-8 h-8" />,
      key: 'government',
      color: 'bg-stone-500',
      videoSrc: '/videos/muted/govnt1-muted.mp4',
    },
    {
      icon: <Mail className="w-8 h-8" />,
      key: 'aiChat',
      color: 'bg-amber-700',
      videoSrc: '/videos/muted/email1-muted.mp4',
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-faxi-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-faxi-brown/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-faxi-brown/10 dark:bg-faxi-brown/20 text-faxi-brown dark:text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
            <span className="w-2 h-2 bg-faxi-accent rounded-full" />
            {locale === 'ja' ? '活用シーン' : 'Use Cases'}
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-faxi-brown dark:text-white mb-6">
            {t('title')}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </div>

        {/* Use Case Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {useCases.map((useCase, index) => (
            <UseCaseCard
              key={useCase.key}
              icon={useCase.icon}
              title={t(`${useCase.key}.title`)}
              demographic={t(`${useCase.key}.demographic`)}
              problem={t(`${useCase.key}.problem`)}
              solution={t(`${useCase.key}.solution`)}
              locale={locale}
              index={index}
              color={useCase.color}
              videoSrc={useCase.videoSrc}
              onViewDemo={() => setSelectedVideo({ src: useCase.videoSrc, title: t(`${useCase.key}.title`) })}
            />
          ))}
        </div>

        {/* Video Modal */}
        <VideoModal
          isOpen={!!selectedVideo}
          onClose={() => setSelectedVideo(null)}
          videoSrc={selectedVideo?.src || ''}
          title={selectedVideo?.title || ''}
        />


      </div>
    </section>
  );
}
