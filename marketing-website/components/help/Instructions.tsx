'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Phone, Mail, ShoppingCart, Calendar, MessageCircle, Clock, FileCheck, ArrowRight } from 'lucide-react';

type UseCase = 'email' | 'shopping' | 'appointments' | 'qa';

export default function Instructions() {
  const t = useTranslations('help.instructions');
  const [activeTab, setActiveTab] = useState<UseCase>('email');

  const tabs: { id: UseCase; icon: typeof Mail; label: string }[] = [
    { id: 'email', icon: Mail, label: t('useCaseTabs.email') },
    { id: 'shopping', icon: ShoppingCart, label: t('useCaseTabs.shopping') },
    { id: 'appointments', icon: Calendar, label: t('useCaseTabs.appointments') },
    { id: 'qa', icon: MessageCircle, label: t('useCaseTabs.qa') },
  ];

  const renderUseCaseContent = (useCase: UseCase) => {
    const steps = [
      t(`${useCase}.steps.step1`),
      t(`${useCase}.steps.step2`),
      t(`${useCase}.steps.step3`),
      t(`${useCase}.steps.step4`),
    ];

    // Shopping has an extra step
    if (useCase === 'shopping') {
      steps.push(t(`${useCase}.steps.step5`));
    }

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-2xl font-bold text-faxi-brown-dark mb-2">
            {t(`${useCase}.title`)}
          </h3>
          <p className="text-gray-600">
            {t(`${useCase}.description`)}
          </p>
        </div>

        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-faxi-brown-dark">
            {t('basicSteps.title')}
          </h4>
          <ol className="space-y-3">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="text-gray-700 pt-1">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-amber-900 mb-2">
            {t(`${useCase}.example`)}
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">💡 </span>
            {t(`${useCase}.tips`)}
          </p>
        </div>

        {/* Visual example placeholder */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <div className="text-gray-400 mb-2">
            <FileCheck className="w-12 h-12 mx-auto" />
          </div>
          <p className="text-gray-500 text-sm">
            {t('visualExamples.comingSoon')}
          </p>
        </div>
      </div>
    );
  };

  return (
    <section id="instructions" className="py-16 bg-white">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-faxi-brown-dark mb-4">
            {t('title')}
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            {t('description')}
          </p>
        </div>

        {/* Fax Numbers - Prominent Display */}
        <div className="bg-gradient-to-r from-faxi-brown to-faxi-brown-dark text-white rounded-xl p-8 mb-12 shadow-lg">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Phone className="w-8 h-8" />
            <h3 className="text-2xl font-bold">{t('faxNumbers.title')}</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-center">
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <p className="text-3xl font-bold mb-1">050-5050-8899</p>
              <p className="text-amber-200">{t('faxNumbers.japan').split(':')[0]}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
              <p className="text-3xl font-bold mb-1">1-302-400-8899</p>
              <p className="text-amber-200">{t('faxNumbers.usa').split(':')[0]}</p>
            </div>
          </div>
          <p className="text-center text-amber-100 mt-4 text-sm">
            {t('faxNumbers.description')}
          </p>
        </div>

        {/* Basic Steps */}
        <div className="mb-12">
          <h3 className="text-2xl font-bold text-faxi-brown-dark mb-6 text-center">
            {t('basicSteps.title')}
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="text-center">
                <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-700 font-bold text-2xl flex items-center justify-center mx-auto mb-4">
                  {step}
                </div>
                <h4 className="font-semibold text-faxi-brown-dark mb-2">
                  {t(`basicSteps.step${step}.title`)}
                </h4>
                <p className="text-sm text-gray-600">
                  {t(`basicSteps.step${step}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Use Case Tabs */}
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-faxi-brown-dark mb-6 text-center">
            {t('useCaseTabs.email')} / {t('useCaseTabs.shopping')} / {t('useCaseTabs.appointments')} / {t('useCaseTabs.qa')}
          </h3>
          
          {/* Tab Navigation */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-faxi-brown text-white shadow-lg scale-105'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="bg-gray-50 rounded-xl p-8 border border-gray-200">
            {renderUseCaseContent(activeTab)}
          </div>
        </div>

        {/* Response Information */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-8 border border-blue-200">
          <h3 className="text-2xl font-bold text-faxi-brown-dark mb-6 text-center">
            {t('responseInfo.title')}
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-faxi-brown-dark mb-2">
                {t('responseInfo.processingTime.title')}
              </h4>
              <p className="text-sm text-gray-600">
                {t('responseInfo.processingTime.description')}
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-3">
                <FileCheck className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-faxi-brown-dark mb-2">
                {t('responseInfo.confirmationFormat.title')}
              </h4>
              <p className="text-sm text-gray-600">
                {t('responseInfo.confirmationFormat.description')}
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-3">
                <ArrowRight className="w-6 h-6" />
              </div>
              <h4 className="font-semibold text-faxi-brown-dark mb-2">
                {t('responseInfo.followUp.title')}
              </h4>
              <p className="text-sm text-gray-600">
                {t('responseInfo.followUp.description')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
