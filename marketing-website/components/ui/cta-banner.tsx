'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles, Users, Code } from 'lucide-react';

interface CTABannerProps {
  audience?: 'families' | 'partners' | 'investors';
  locale: string;
  variant?: 'default' | 'compact';
}

export function CTABanner({ audience = 'families', locale, variant = 'default' }: CTABannerProps) {
  const t = useTranslations('cta');

  const getConfig = () => {
    switch (audience) {
      case 'families':
        return {
          title: locale === 'ja' ? 'Faxiを始めましょう' : 'Get Started with Faxi',
          description: locale === 'ja'
            ? 'ご両親のFAXをインターネットに接続して、オンラインサービスへのアクセスを簡単にしましょう。'
            : "Connect your parents' fax machine to the internet and make online services accessible.",
          primaryCta: { text: t('families.signUp'), href: `/${locale}/service#signup` },
          secondaryCta: { text: t('general.tryDemo'), href: `/${locale}/demo` },
          icon: <Users className="w-8 h-8" />,
          gradient: 'from-faxi-brown via-faxi-brown-dark to-faxi-footer',
        };
      case 'partners':
        return {
          title: locale === 'ja' ? '提携について' : 'Partner With Us',
          description: locale === 'ja'
            ? '1000万人の高齢者市場にアクセスし、サービスのアクセシビリティを向上させましょう。'
            : 'Access the 10M+ elderly market and improve service accessibility.',
          primaryCta: { text: t('partners.partnerWithUs'), href: `/${locale}/partnering#contact` },
          secondaryCta: { text: t('partners.requestDemo'), href: `/${locale}/demo` },
          icon: <Sparkles className="w-8 h-8" />,
          gradient: 'from-faxi-accent via-faxi-accent/80 to-faxi-brown',
        };
      case 'investors':
        return {
          title: locale === 'ja' ? '技術詳細を見る' : 'Explore the Technology',
          description: locale === 'ja'
            ? 'オープンソースコードと技術ドキュメントをご覧ください。'
            : 'Explore our open-source code and technical documentation.',
          primaryCta: { text: t('investors.viewGithub'), href: 'https://github.com/faxi-ai/faxi', external: true },
          secondaryCta: { text: t('investors.technicalDetails'), href: `/${locale}/tech` },
          icon: <Code className="w-8 h-8" />,
          gradient: 'from-faxi-brown-light via-faxi-brown to-faxi-footer',
        };
    }
  };

  const config = getConfig();

  if (variant === 'compact') {
    return (
      <section className={`py-12 bg-gradient-to-r ${config.gradient} relative overflow-hidden`}>
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-white text-center md:text-left flex items-center gap-4">
              <div className="hidden md:flex w-14 h-14 bg-white/10 rounded-xl items-center justify-center">
                {config.icon}
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-1">{config.title}</h3>
                <p className="text-white/70 text-sm max-w-md">{config.description}</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href={config.primaryCta.href}
                className="inline-flex items-center justify-center gap-2 bg-white text-faxi-brown px-6 py-3 rounded-full font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
              >
                {config.primaryCta.text}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href={config.secondaryCta.href}
                className="inline-flex items-center justify-center gap-2 bg-transparent border-2 border-white text-white px-6 py-3 rounded-full font-semibold hover:bg-white hover:text-faxi-brown transition-all duration-300"
              >
                {config.secondaryCta.text}
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 md:py-32 relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/page-header-bg.jpg"
          alt=""
          fill
          className="object-cover"
        />
        <div className={`absolute inset-0 bg-gradient-to-r ${config.gradient} opacity-95`} />
      </div>

      {/* Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-20 right-20 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Icon */}
          <div className="inline-flex w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl items-center justify-center mb-8 text-white">
            {config.icon}
          </div>

          {/* Title */}
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            {config.title}
          </h2>

          {/* Description */}
          <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed">
            {config.description}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {config.primaryCta.external ? (
              <a
                href={config.primaryCta.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center justify-center gap-2 bg-white text-faxi-brown px-8 py-4 rounded-full font-semibold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300"
              >
                {config.primaryCta.text}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>
            ) : (
              <Link
                href={config.primaryCta.href}
                className="group inline-flex items-center justify-center gap-2 bg-white text-faxi-brown px-8 py-4 rounded-full font-semibold text-lg shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300"
              >
                {config.primaryCta.text}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            )}
            <Link
              href={config.secondaryCta.href}
              className="inline-flex items-center justify-center gap-2 bg-transparent border-2 border-white text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-white hover:text-faxi-brown transition-all duration-300"
            >
              {config.secondaryCta.text}
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-white/60 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>{locale === 'ja' ? '簡単セットアップ' : 'Easy Setup'}</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>{locale === 'ja' ? '24時間対応' : '24/7 Available'}</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>{locale === 'ja' ? 'オープンソース' : 'Open Source'}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
