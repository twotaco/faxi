'use client';

import { useEffect, useState } from 'react';
import { useDemo } from '@/lib/hooks/useDemo';
import { FixtureSelection } from '@/components/demo/FixtureSelection';
import { FileUpload } from '@/components/demo/FileUpload';
import { ProcessingStatus } from '@/components/demo/ProcessingStatus';
import { ResultsDisplay } from '@/components/demo/ResultsDisplay';
import { Button } from '@/components/ui/button';
import type { DemoFixture } from '@/lib/api/types';

export default function DemoPage() {
  const {
    fixtures,
    isLoadingFixtures,
    fixturesError,
    fetchFixtures,
    processingResult,
    isProcessing,
    processingError,
    processFixture,
    processUpload,
  } = useDemo();

  const [selectedFixture, setSelectedFixture] = useState<DemoFixture | null>(null);
  const [mode, setMode] = useState<'fixture' | 'upload'>('fixture');

  useEffect(() => {
    fetchFixtures();
  }, [fetchFixtures]);

  const handleFixtureSelect = (fixture: DemoFixture) => {
    setSelectedFixture(fixture);
    setMode('fixture');
  };

  const handleProcessFixture = () => {
    if (selectedFixture) {
      processFixture(selectedFixture.id);
    }
  };

  const handleFileUpload = (file: File) => {
    setMode('upload');
    setSelectedFixture(null);
    processUpload(file);
  };

  const handleReset = () => {
    setSelectedFixture(null);
    setMode('fixture');
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Interactive Demo</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Experience how Faxi transforms handwritten faxes into digital actions using AI.
            Try our sample faxes or upload your own.
          </p>
        </div>

        {/* Error Display */}
        {(fixturesError || processingError) && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <p className="font-semibold">Error</p>
            <p>{fixturesError || processingError}</p>
          </div>
        )}

        {/* Processing Status */}
        {isProcessing && (
          <div className="mb-8">
            <ProcessingStatus isProcessing={isProcessing} />
          </div>
        )}

        {/* Results Display */}
        {processingResult && !isProcessing && (
          <div className="mb-8">
            <ResultsDisplay result={processingResult} />
            <div className="mt-6 text-center">
              <Button onClick={handleReset} size="lg">
                Try Another Fax
              </Button>
            </div>
          </div>
        )}

        {/* Demo Interface - Only show if not processing and no results */}
        {!isProcessing && !processingResult && (
          <div className="space-y-12">
            {/* Mode Toggle */}
            <div className="flex justify-center space-x-4">
              <Button
                variant={mode === 'fixture' ? 'default' : 'outline'}
                onClick={() => setMode('fixture')}
              >
                Sample Faxes
              </Button>
              <Button
                variant={mode === 'upload' ? 'default' : 'outline'}
                onClick={() => setMode('upload')}
              >
                Upload Your Own
              </Button>
            </div>

            {/* Fixture Selection */}
            {mode === 'fixture' && (
              <div>
                <FixtureSelection
                  fixtures={fixtures}
                  selectedFixture={selectedFixture}
                  onSelect={handleFixtureSelect}
                  isLoading={isLoadingFixtures}
                />
                {selectedFixture && (
                  <div className="mt-6 text-center">
                    <Button onClick={handleProcessFixture} size="lg">
                      Process Selected Fax
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* File Upload */}
            {mode === 'upload' && (
              <FileUpload
                onFileSelect={handleFileUpload}
                isProcessing={isProcessing}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
