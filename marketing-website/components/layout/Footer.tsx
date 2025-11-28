'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { FileText, Book, Mail, MapPin, ArrowUpRight } from 'lucide-react';

export function Footer({ locale }: { locale: string }) {
  const t = useTranslations('navigation');

  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative bg-faxi-footer text-white overflow-hidden">
      {/* Decorative top border */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-faxi-brown via-faxi-brown-light to-faxi-brown" />

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-faxi-brown/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        {/* Main Footer Content */}
        <div className="py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand Column */}
          <div className="lg:col-span-1">
            <Link href={`/${locale}`} className="flex items-center gap-3 mb-6">
              <div className="relative w-14 h-14 rounded-full overflow-hidden shadow-lg border-2 border-white/20">
                <Image
                  src="/images/faxi-logo-round.png"
                  alt="Faxi"
                  fill
                  className="object-cover"
                />
              </div>
              <span className="text-2xl font-bold">Faxi</span>
            </Link>
            <p className="text-white/70 mb-6 leading-relaxed">
              {locale === 'ja'
                ? 'AIの力でFAXをインターネットに接続し、すべての人にデジタルサービスへのアクセスを提供します。'
                : 'Connecting fax machines to the internet with AI, making digital services accessible to everyone.'}
            </p>
            <div className="flex gap-3">
              <a
                href="mailto:contact@faxi.jp"
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                aria-label="Email"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Services Column */}
          <div>
            <h4 className="font-semibold text-lg mb-6 flex items-center gap-2">
              <span className="w-8 h-0.5 bg-faxi-brown-light rounded-full" />
              {locale === 'ja' ? 'サービス' : 'Services'}
            </h4>
            <ul className="space-y-4">
              <li>
                <Link
                  href={`/${locale}/service`}
                  className="group flex items-center gap-2 text-white/70 hover:text-white transition-colors"
                >
                  <span>{t('service')}</span>
                  <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/partnering`}
                  className="group flex items-center gap-2 text-white/70 hover:text-white transition-colors"
                >
                  <span>{t('partnering')}</span>
                  <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/demo`}
                  className="group flex items-center gap-2 text-white/70 hover:text-white transition-colors"
                >
                  <span>{t('demo')}</span>
                  <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Developers Column */}
          <div>
            <h4 className="font-semibold text-lg mb-6 flex items-center gap-2">
              <span className="w-8 h-0.5 bg-faxi-brown-light rounded-full" />
              {locale === 'ja' ? '開発者向け' : 'Developers'}
            </h4>
            <ul className="space-y-4">
              <li>
                <a
                  href="https://docs.faxi.jp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 text-white/70 hover:text-white transition-colors"
                >
                  <Book className="h-4 w-4" />
                  <span>{locale === 'ja' ? 'ドキュメント' : 'Documentation'}</span>
                  <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              </li>
              <li>
                <a
                  href="https://api.faxi.jp/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 text-white/70 hover:text-white transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  <span>API {locale === 'ja' ? 'ドキュメント' : 'Docs'}</span>
                  <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              </li>
              <li>
                <Link
                  href={`/${locale}/tech`}
                  className="group flex items-center gap-2 text-white/70 hover:text-white transition-colors"
                >
                  <span>{t('tech')}</span>
                  <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Contact Column */}
          <div>
            <h4 className="font-semibold text-lg mb-6 flex items-center gap-2">
              <span className="w-8 h-0.5 bg-faxi-brown-light rounded-full" />
              {locale === 'ja' ? '会社情報' : 'Company'}
            </h4>
            <ul className="space-y-4">
              <li>
                <Link
                  href={`/${locale}/about`}
                  className="group flex items-center gap-2 text-white/70 hover:text-white transition-colors"
                >
                  <span>{t('about')}</span>
                  <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/privacy`}
                  className="group flex items-center gap-2 text-white/70 hover:text-white transition-colors"
                >
                  <span>{t('privacy')}</span>
                  <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link
                  href={`/${locale}/terms`}
                  className="group flex items-center gap-2 text-white/70 hover:text-white transition-colors"
                >
                  <span>{t('terms')}</span>
                  <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
            </ul>

            {/* Contact Info */}
            <div className="mt-8 space-y-3">
              <div className="flex items-center gap-3 text-white/60 text-sm">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span>{locale === 'ja' ? '東京都' : 'Tokyo, Japan'}</span>
              </div>
              <div className="flex items-center gap-3 text-white/60 text-sm">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span>contact@faxi.jp</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/50 text-sm">
            © {currentYear} Faxi. {locale === 'ja' ? '全著作権所有' : 'All rights reserved.'}
          </p>
          <div className="flex items-center gap-6 text-sm">
            <Link href={`/${locale}/privacy`} className="text-white/50 hover:text-white transition-colors">
              {t('privacy')}
            </Link>
            <Link href={`/${locale}/terms`} className="text-white/50 hover:text-white transition-colors">
              {t('terms')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
