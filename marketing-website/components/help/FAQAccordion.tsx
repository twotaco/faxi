'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

interface FAQItem {
  key: string;
  category: string;
  question: string;
  answer: string;
  keywords: string[];
}

export default function FAQAccordion() {
  const t = useTranslations('help.faq');
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Build FAQ items from translations
  const allFaqItems: FAQItem[] = useMemo(() => {
    const faqKeys = [
      'registration',
      'cost',
      'faxMachine',
      'handwriting',
      'languages',
      'responseTime',
      'multipleRequests',
      'followUp',
      'notReceived',
      'unclear',
      'wrongInfo',
      'pricing',
      'refund',
      'dataPrivacy',
      'dataRetention',
      'whoCanSee',
    ];

    return faqKeys.map((key) => ({
      key,
      category: t(`items.${key}.category`),
      question: t(`items.${key}.question`),
      answer: t(`items.${key}.answer`),
      keywords: [], // Keywords are in translations but not needed for display
    }));
  }, [t]);

  // Filter FAQs based on search query
  const filteredFaqItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return allFaqItems;
    }

    const query = searchQuery.toLowerCase();
    return allFaqItems.filter((item) => {
      return (
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query)
      );
    });
  }, [allFaqItems, searchQuery]);

  // Group FAQs by category
  const faqsByCategory = useMemo(() => {
    const categories = [
      'gettingStarted',
      'usingService',
      'troubleshooting',
      'billing',
      'privacy',
    ];

    return categories.map((categoryKey) => ({
      key: categoryKey,
      title: t(`categories.${categoryKey}`),
      items: filteredFaqItems.filter((item) => item.category === categoryKey),
    }));
  }, [filteredFaqItems, t]);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  // Calculate global index for each FAQ item
  let globalIndex = -1;

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('title')}</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            {t('description')}
          </p>

          {/* Search Input */}
          <div className="max-w-xl mx-auto">
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-faxi-brown focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          {filteredFaqItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">{t('noResults')}</p>
            </div>
          ) : (
            faqsByCategory.map((category) => {
              if (category.items.length === 0) return null;

              return (
                <div key={category.key} className="mb-12">
                  <h3 className="text-2xl font-bold mb-6 text-faxi-brown">
                    {category.title}
                  </h3>

                  <div className="space-y-4">
                    {category.items.map((item) => {
                      globalIndex++;
                      const currentIndex = globalIndex;

                      return (
                        <div
                          key={item.key}
                          className="bg-gray-50 rounded-lg shadow-sm overflow-hidden border border-gray-200 hover:border-faxi-brown transition-colors"
                        >
                          <button
                            onClick={() => toggleFAQ(currentIndex)}
                            className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-100 transition-colors"
                            aria-expanded={openIndex === currentIndex}
                          >
                            <span className="font-semibold text-lg pr-4">
                              {item.question}
                            </span>
                            {openIndex === currentIndex ? (
                              <ChevronUp
                                size={24}
                                className="text-faxi-brown flex-shrink-0"
                              />
                            ) : (
                              <ChevronDown
                                size={24}
                                className="text-gray-400 flex-shrink-0"
                              />
                            )}
                          </button>

                          {openIndex === currentIndex && (
                            <div className="px-6 pb-6 text-gray-700 leading-relaxed">
                              {item.answer}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
