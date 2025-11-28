'use client';

import { useTranslations } from 'next-intl';
import { FileText, Send, Cpu, CheckCircle } from 'lucide-react';

export default function ServiceOverview() {
  const t = useTranslations('service.overview');

  const steps = [
    {
      key: 'register',
      icon: FileText,
      color: 'text-faxi-brown',
      bgColor: 'bg-amber-100',
    },
    {
      key: 'send',
      icon: Send,
      color: 'text-amber-700',
      bgColor: 'bg-amber-50',
    },
    {
      key: 'process',
      icon: Cpu,
      color: 'text-stone-600',
      bgColor: 'bg-stone-100',
    },
    {
      key: 'receive',
      icon: CheckCircle,
      color: 'text-faxi-brown-dark',
      bgColor: 'bg-amber-100',
    },
  ];

  return (
    <section className="py-16 bg-gradient-to-b from-white to-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('title')}</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.key}
                className="relative flex flex-col items-center text-center"
              >
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-1/2 w-full h-0.5 bg-gray-300 -z-10" />
                )}

                {/* Icon */}
                <div
                  className={`${step.bgColor} ${step.color} w-24 h-24 rounded-full flex items-center justify-center mb-4 shadow-lg`}
                >
                  <Icon size={40} />
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold mb-2">
                  {t(`steps.${step.key}.title`)}
                </h3>
                <p className="text-gray-600">
                  {t(`steps.${step.key}.description`)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Example Fax Formats Section */}
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold mb-4 text-center">
            {t('exampleTitle')}
          </h3>
          <p className="text-gray-600 text-center mb-8">
            {t('exampleDescription')}
          </p>

          {/* Example format cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-br from-amber-50 to-white rounded-lg p-6 text-center border border-amber-200">
              <div className="text-4xl mb-3">📧</div>
              <p className="font-semibold text-faxi-brown mb-2">Email Family</p>
              <p className="text-sm text-gray-600">
                Write a message—we save your address book so you just write names
              </p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-white rounded-lg p-6 text-center border border-amber-200">
              <div className="text-4xl mb-3">🏥</div>
              <p className="font-semibold text-faxi-brown mb-2">Healthcare</p>
              <p className="text-sm text-gray-600">
                Write date and time preference for appointments
              </p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-white rounded-lg p-6 text-center border border-amber-200">
              <div className="text-4xl mb-3">🛒</div>
              <p className="font-semibold text-faxi-brown mb-2">Shopping</p>
              <p className="text-sm text-gray-600">
                Write what you need—we send options to choose from
              </p>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-white rounded-lg p-6 text-center border border-amber-200">
              <div className="text-4xl mb-3">❓</div>
              <p className="font-semibold text-faxi-brown mb-2">Questions</p>
              <p className="text-sm text-gray-600">
                Write any question—get detailed answers by fax
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
