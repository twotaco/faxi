'use client';

import { useTranslations } from 'next-intl';
import { FileText, Send, Cpu, CheckCircle } from 'lucide-react';

export default function ServiceOverview() {
  const t = useTranslations('service.overview');

  const steps = [
    {
      key: 'register',
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      key: 'send',
      icon: Send,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      key: 'process',
      icon: Cpu,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      key: 'receive',
      icon: CheckCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
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

          {/* Example diagrams - placeholder for now */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <div className="text-4xl mb-2">📋</div>
              <p className="font-semibold mb-2">Healthcare</p>
              <p className="text-sm text-gray-600">
                Appointment booking form
              </p>
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <div className="text-4xl mb-2">🛒</div>
              <p className="font-semibold mb-2">Shopping</p>
              <p className="text-sm text-gray-600">
                Product selection with checkmarks
              </p>
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <div className="text-4xl mb-2">💬</div>
              <p className="font-semibold mb-2">AI Chat</p>
              <p className="text-sm text-gray-600">
                Question and answer format
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
