'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

interface HeroSectionProps {
  locale: string;
}

const VIDEO_SEQUENCE = [
  '/videos/muted/ecomm2-muted.mp4',
  '/videos/muted/email2-muted.mp4',
  '/videos/muted/appointment1-muted.mp4',
];

export function HeroSection({ locale }: HeroSectionProps) {
  const t = useTranslations('home.hero.families');
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVideoEnd = () => {
      // Move to next video in sequence
      setCurrentVideoIndex((prev) => (prev + 1) % VIDEO_SEQUENCE.length);
    };

    const handleLoadedData = () => {
      // Preload next video
      const nextIndex = (currentVideoIndex + 1) % VIDEO_SEQUENCE.length;
      const preloadLink = document.createElement('link');
      preloadLink.rel = 'preload';
      preloadLink.as = 'video';
      preloadLink.href = VIDEO_SEQUENCE[nextIndex];
      document.head.appendChild(preloadLink);
    };

    video.addEventListener('ended', handleVideoEnd);
    video.addEventListener('loadeddata', handleLoadedData);
    
    return () => {
      video.removeEventListener('ended', handleVideoEnd);
      video.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [currentVideoIndex]); // Re-attach listener when video changes

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden -mt-20 pt-20">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/section-banner.jpg"
          alt=""
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-faxi-brown/95 via-faxi-brown/80 to-faxi-brown/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-faxi-brown/50 via-transparent to-transparent" />
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-20 right-10 w-72 h-72 bg-faxi-accent/20 rounded-full blur-3xl animate-blob" />
      <div className="absolute bottom-20 left-10 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-blob animation-delay-2000" />
      <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-faxi-brown-light/20 rounded-full blur-3xl animate-blob animation-delay-4000" />

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="text-white space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              <span className="text-sm font-medium">
                {locale === 'ja' ? 'AI搭載FAXゲートウェイ' : 'AI-Powered Fax Gateway'}
              </span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              {t('headline')}
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-white/90 max-w-xl leading-relaxed">
              {t('subheadline')}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href={`/${locale}/service`}
                className="group inline-flex items-center justify-center gap-2 bg-white text-faxi-brown px-8 py-4 rounded-full font-semibold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300"
              >
                {t('ctaPrimary')}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href={`/${locale}/demo`}
                className="group inline-flex items-center justify-center gap-2 bg-transparent border-2 border-white text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-white hover:text-faxi-brown transition-all duration-300"
              >
                <Play className="w-5 h-5" />
                {t('ctaSecondary')}
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center gap-8 pt-4">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-sm font-bold"
                    >
                      {['👴', '👵', '👨', '👩'][i - 1]}
                    </div>
                  ))}
                </div>
                <span className="text-sm text-white/80">
                  {locale === 'ja' ? '多くのご家族が利用中' : 'Trusted by families'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">99%</span>
                <span className="text-sm text-white/80">
                  {locale === 'ja' ? '満足度' : 'Satisfaction'}
                </span>
              </div>
            </div>
          </div>

          {/* Hero Video/Visual */}
          <div className="hidden lg:block relative">
            <div className="relative">
              {/* Main Video Card */}
              <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden transform rotate-2 hover:rotate-0 transition-transform duration-500">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  preload="auto"
                  className="w-full h-auto object-cover"
                  style={{ aspectRatio: '3/2.4' }}
                  key={currentVideoIndex}
                >
                  <source src={VIDEO_SEQUENCE[currentVideoIndex]} type="video/mp4" />
                </video>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          viewBox="0 0 1440 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto"
        >
          <path
            d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            className="fill-white dark:fill-gray-900"
          />
        </svg>
      </div>
    </section>
  );
}
