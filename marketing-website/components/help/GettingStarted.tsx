'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight, Printer, Zap, CheckCircle, Send } from 'lucide-react';
import Link from 'next/link';

interface GettingStartedProps {
  locale: string;
}

export function GettingStarted({ locale }: GettingStartedProps) {
  const t = useTranslations('help.gettingStarted');

  const benefits = [
    {
      icon: <Printer className="w-6 h-6" />,
      title: locale === 'ja' ? '使い慣れたFAX機' : 'Familiar Fax Machine',
      description: locale === 'ja' 
        ? '新しい技術を学ぶ必要はありません。いつも使っているFAX機をそのまま使えます。'
        : 'No need to learn new technology. Use your fax machine just like you always have.',
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: locale === 'ja' ? '即座に応答' : 'Instant Responses',
      description: locale === 'ja'
        ? 'AIが数秒でFAXを処理し、数分以内に返信FAXをお送りします。'
        : 'AI processes your fax in seconds and sends a response back within minutes.',
    },
    {
      icon: <CheckCircle className="w-6 h-6" />,
      title: locale === 'ja' ? '多様なサービス' : 'Multiple Services',
      description: locale === 'ja'
        ? 'メール、ショッピング、予約、情報検索など、すべてFAXで利用できます。'
        : 'Access email, shopping, appointments, and information—all through fax.',
    },
  ];

  return (
    <section id="getting-started" className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-faxi-brown mb-4">
              {t('title')}
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              {t('description')}
            </p>
          </div>

          {/* Overview Content */}
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            {/* Left: What is Faxi */}
            <div>
              <h3 className="text-2xl font-bold text-faxi-brown mb-4">
                {locale === 'ja' ? 'Faxiとは？' : 'What is Faxi?'}
              </h3>
              <p className="text-gray-700 mb-6 leading-relaxed">
                {locale === 'ja'
                  ? 'Faxiは、あなたのFAX機を現代のインターネットサービスに接続する革新的なサービスです。パソコンやスマートフォンを使わずに、メールの送受信、オンラインショッピング、予約、情報検索などができます。'
                  : 'Faxi is an innovative service that connects your fax machine to modern internet services. Send and receive emails, shop online, book appointments, and search for information—all without using a computer or smartphone.'}
              </p>
              <p className="text-gray-700 leading-relaxed">
                {locale === 'ja'
                  ? '最新のAI技術を使って、手書きのFAXを読み取り、あなたの意図を理解し、適切なサービスに接続します。返信もFAXで届くので、使い慣れた方法でやり取りできます。'
                  : 'Using advanced AI technology, Faxi reads your handwritten faxes, understands your intent, and connects to the appropriate services. Responses come back as faxes, so you can communicate in the familiar way you prefer.'}
              </p>
            </div>

            {/* Right: Visual Diagram */}
            <div className="relative">
              <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl p-8 shadow-lg">
                {/* Fax to Internet Flow Diagram */}
                <div className="space-y-6">
                  {/* Step 1: Fax Machine */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                      <Printer className="w-8 h-8 text-faxi-brown" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-faxi-brown">
                        {locale === 'ja' ? 'あなたのFAX機' : 'Your Fax Machine'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {locale === 'ja' ? 'リクエストを書いて送信' : 'Write and send request'}
                      </div>
                    </div>
                  </div>

                  {/* Arrow Down */}
                  <div className="flex justify-center">
                    <ArrowRight className="w-6 h-6 text-amber-600 rotate-90" />
                  </div>

                  {/* Step 2: AI Processing */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                      <Zap className="w-8 h-8 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-faxi-brown">
                        {locale === 'ja' ? 'AI処理' : 'AI Processing'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {locale === 'ja' ? '内容を理解し処理' : 'Understands and processes'}
                      </div>
                    </div>
                  </div>

                  {/* Arrow Down */}
                  <div className="flex justify-center">
                    <ArrowRight className="w-6 h-6 text-amber-600 rotate-90" />
                  </div>

                  {/* Step 3: Internet Services */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                      <Send className="w-8 h-8 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-faxi-brown">
                        {locale === 'ja' ? 'インターネットサービス' : 'Internet Services'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {locale === 'ja' ? 'メール、ショッピング、予約など' : 'Email, shopping, appointments'}
                      </div>
                    </div>
                  </div>

                  {/* Arrow Down */}
                  <div className="flex justify-center">
                    <ArrowRight className="w-6 h-6 text-amber-600 rotate-90" />
                  </div>

                  {/* Step 4: Response Fax */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-md flex-shrink-0">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-faxi-brown">
                        {locale === 'ja' ? '確認FAX' : 'Confirmation Fax'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {locale === 'ja' ? '結果がFAXで届く' : 'Results sent back to you'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Benefits */}
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-faxi-brown mb-8 text-center">
              {locale === 'ja' ? '主な特徴' : 'Key Benefits'}
            </h3>
            <div className="grid md:grid-cols-3 gap-8">
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-br from-white to-amber-50 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow border border-amber-100"
                >
                  <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4 text-amber-700">
                    {benefit.icon}
                  </div>
                  <h4 className="font-semibold text-faxi-brown mb-2">
                    {benefit.title}
                  </h4>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA to Instructions */}
          <div className="text-center">
            <Link
              href="#instructions"
              className="inline-flex items-center gap-2 bg-faxi-brown hover:bg-faxi-brown-dark text-white px-8 py-4 rounded-xl font-semibold transition-colors shadow-lg hover:shadow-xl"
              onClick={(e) => {
                e.preventDefault();
                const element = document.querySelector('#instructions');
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            >
              {locale === 'ja' ? '詳しい使い方を見る' : 'See Detailed Instructions'}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
