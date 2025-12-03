'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useDemo } from '@/lib/hooks/useDemo';
import { FixtureSelection } from '@/components/demo/FixtureSelection';
import { FileUpload } from '@/components/demo/FileUpload';
import { CustomFaxCreator } from '@/components/demo/CustomFaxCreator';
import { ProcessingStatus } from '@/components/demo/ProcessingStatus';
import { ResultsDisplay } from '@/components/demo/ResultsDisplay';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import type { DemoFixture } from '@/lib/api/types';

export default function DemoPage() {
  const params = useParams();
  const locale = params.locale as string;
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
    processImageData,
    reset,
  } = useDemo();

  const [selectedFixture, setSelectedFixture] = useState<DemoFixture | null>(null);
  const [mode, setMode] = useState<'fixture' | 'upload' | 'create'>('fixture');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    fetchFixtures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only fetch on mount

  const handleFixtureSelect = (fixture: DemoFixture) => {
    setSelectedFixture(fixture);
    setMode('fixture');
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const handleProcessFixture = () => {
    if (selectedFixture) {
      setIsDialogOpen(false);
      processFixture(selectedFixture.id);
    }
  };

  const handleFileUpload = (file: File) => {
    setMode('upload');
    setSelectedFixture(null);
    processUpload(file);
  };

  const handleCustomFax = (imageData: string) => {
    setSelectedFixture(null);
    processImageData(imageData);
  };

  const handleReset = () => {
    reset(); // Clear processing result from hook
    setSelectedFixture(null);
    setMode('fixture');
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center items-center gap-4 mb-4">
            <h1 className="text-4xl font-bold">Interactive Demo</h1>
            <Link href={`/${locale}/help#demo`}>
              <Button variant="outline" size="sm" className="gap-2">
                <HelpCircle className="h-4 w-4" />
                Help Guide
              </Button>
            </Link>
          </div>
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
            <div className="flex justify-center flex-wrap gap-2">
              <Button
                variant={mode === 'fixture' ? 'default' : 'outline'}
                onClick={() => setMode('fixture')}
              >
                Sample Faxes
              </Button>
              <Button
                variant={mode === 'create' ? 'default' : 'outline'}
                onClick={() => setMode('create')}
              >
                Create Your Own
              </Button>
              <Button
                variant={mode === 'upload' ? 'default' : 'outline'}
                onClick={() => setMode('upload')}
              >
                Upload File
              </Button>
            </div>

            {/* Fixture Selection */}
            {mode === 'fixture' && (
              <FixtureSelection
                fixtures={fixtures}
                selectedFixture={selectedFixture}
                onSelect={handleFixtureSelect}
                isLoading={isLoadingFixtures}
              />
            )}

            {/* Create Your Own */}
            {mode === 'create' && (
              <CustomFaxCreator
                onSubmit={handleCustomFax}
                isProcessing={isProcessing}
              />
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

        {/* Fixture Preview Dialog */}
        <Dialog open={isDialogOpen} onClose={handleCloseDialog}>
          <DialogContent className="h-[50vh] flex flex-col">
            <DialogClose onClose={handleCloseDialog} />
            {selectedFixture && (
              <>
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>{selectedFixture.name}</DialogTitle>
                  <DialogDescription>{selectedFixture.description}</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="bg-gray-100 rounded-lg overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}${selectedFixture.thumbnailUrl}`}
                      alt={`Sample fax: ${selectedFixture.name}`}
                      className="w-full h-auto scale-125 origin-top-left"
                    />
                  </div>
                </div>
                <DialogFooter className="flex-shrink-0">
                  <Button variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button onClick={handleProcessFixture}>
                    Process Selected Fax
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
