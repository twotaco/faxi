'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, Clock, Target, Users } from 'lucide-react';

interface UseCaseDetailCardProps {
  useCaseKey: string;
  icon: string;
}

export default function UseCaseDetailCard({ useCaseKey, icon }: UseCaseDetailCardProps) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations(`service.useCases.${useCaseKey}`);

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
      {/* Card Header */}
      <div className="p-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="text-4xl">{icon}</div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-2">{t('title')}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Users size={16} />
              <span>{t('demographic')}</span>
            </div>
          </div>
        </div>

        {/* Problem */}
        <div className="mb-4">
          <h4 className="font-semibold text-stone-600 mb-2">Problem:</h4>
          <p className="text-gray-700">{t('problem')}</p>
        </div>

        {/* Solution */}
        <div className="mb-4">
          <h4 className="font-semibold text-amber-700 mb-2">Solution:</h4>
          <p className="text-gray-700">{t('solution')}</p>
        </div>

        {/* Before/After Visual Comparison */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">
              {t('beforeLabel')}
            </p>
            <div className="relative aspect-[4/3] bg-gray-100 rounded border-2 border-gray-300 flex items-center justify-center">
              <div className="text-center p-4">
                <div className="text-4xl mb-2">😰</div>
                <span className="text-sm text-gray-500">Complex Digital Interface</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-600 mb-2">
              {t('afterLabel')}
            </p>
            <div className="relative aspect-[4/3] bg-amber-50 rounded border-2 border-amber-300 flex items-center justify-center">
              <div className="text-center p-4">
                <div className="text-4xl mb-2">📠</div>
                <span className="text-sm text-amber-700">Simple Fax Form</span>
              </div>
            </div>
          </div>
        </div>

        {/* Expand/Collapse Button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-2 py-2 text-faxi-brown hover:text-faxi-brown-dark font-semibold transition-colors"
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide technical details' : 'Show technical details'}
        >
          {expanded ? (
            <>
              Hide Technical Details
              <ChevronUp size={20} aria-hidden="true" />
            </>
          ) : (
            <>
              Show Technical Details
              <ChevronDown size={20} aria-hidden="true" />
            </>
          )}
        </button>
      </div>

      {/* Expandable Technical Details */}
      {expanded && (
        <div className="bg-gray-50 p-6 border-t border-gray-200">
          <h4 className="font-semibold text-lg mb-4">{t('technicalTitle')}</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-white p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target size={20} className="text-faxi-brown" />
                <span className="font-semibold">Accuracy</span>
              </div>
              <p className="text-2xl font-bold text-faxi-brown">
                {t('technicalDetails.accuracy')}
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock size={20} className="text-amber-700" />
                <span className="font-semibold">Processing Time</span>
              </div>
              <p className="text-2xl font-bold text-amber-700">
                {t('technicalDetails.processingTime')}
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold">Supported Actions</span>
              </div>
              <p className="text-sm text-gray-600">
                {t('technicalDetails.intents.0')}
              </p>
            </div>
          </div>

          {/* All supported intents */}
          <div>
            <p className="font-semibold mb-2">All Supported Actions:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              {[0, 1, 2, 3].map((index) => {
                try {
                  const intent = t(`technicalDetails.intents.${index}`);
                  return <li key={index}>{intent}</li>;
                } catch {
                  return null;
                }
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
