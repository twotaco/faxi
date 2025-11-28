'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Phone, Printer } from 'lucide-react';

export default function FAQSection() {
  const t = useTranslations('service.faq');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqKeys = ['cost', 'setup', 'accuracy', 'security', 'support', 'services'];

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('title')}</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          {/* FAQ Accordion */}
          <div className="space-y-4 mb-12">
            {faqKeys.map((key, index) => (
              <div
                key={key}
                className="bg-white rounded-lg shadow-md overflow-hidden"
              >
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
                  aria-expanded={openIndex === index}
                >
                  <span className="font-semibold text-lg pr-4">
                    {t(`items.${key}.question`)}
                  </span>
                  {openIndex === index ? (
                    <ChevronUp size={24} className="text-faxi-brown flex-shrink-0" />
                  ) : (
                    <ChevronDown size={24} className="text-gray-400 flex-shrink-0" />
                  )}
                </button>
                
                {openIndex === index && (
                  <div className="px-6 pb-6 text-gray-700 leading-relaxed">
                    {t(`items.${key}.answer`)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Contact Information */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-8 text-center">
            <h3 className="text-2xl font-bold mb-4">{t('contactTitle')}</h3>
            <p className="text-gray-700 mb-6">{t('contactDescription')}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <div className="bg-white rounded-lg p-4 flex items-center gap-3">
                <Phone size={24} className="text-faxi-brown flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm text-gray-600">Phone Support</p>
                  <p className="font-semibold">{t('contactPhone')}</p>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 flex items-center gap-3">
                <Printer size={24} className="text-amber-700 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm text-gray-600">Fax Support</p>
                  <p className="font-semibold">{t('contactFax')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
