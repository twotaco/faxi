'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DrawingCanvas } from './DrawingCanvas';
import { TextToFax } from './TextToFax';

interface CustomFaxCreatorProps {
  onSubmit: (imageData: string) => void;
  isProcessing?: boolean;
}

export function CustomFaxCreator({ onSubmit, isProcessing = false }: CustomFaxCreatorProps) {
  const [activeTab, setActiveTab] = useState<'draw' | 'type'>('draw');

  return (
    <div className="space-y-6">
      {/* Tab Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
          <Button
            variant={activeTab === 'draw' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('draw')}
            className="relative"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            Draw / Write
          </Button>
          <Button
            variant={activeTab === 'type' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('type')}
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Type Message
          </Button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'draw' ? (
        <DrawingCanvas onSubmit={onSubmit} isProcessing={isProcessing} />
      ) : (
        <TextToFax onSubmit={onSubmit} isProcessing={isProcessing} />
      )}
    </div>
  );
}
