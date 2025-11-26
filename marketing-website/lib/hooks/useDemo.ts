'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api/client';
import type { DemoFixture, ProcessResponse, ProcessingResult } from '@/lib/api/types';

export function useDemo() {
  const [fixtures, setFixtures] = useState<DemoFixture[]>([]);
  const [isLoadingFixtures, setIsLoadingFixtures] = useState(false);
  const [fixturesError, setFixturesError] = useState<string | null>(null);

  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);

  const fetchFixtures = async () => {
    setIsLoadingFixtures(true);
    setFixturesError(null);
    try {
      const response = await apiClient.get<{ fixtures: DemoFixture[] }>('/api/demo/fixtures');
      setFixtures(response.fixtures);
    } catch (error) {
      setFixturesError(error instanceof Error ? error.message : 'Failed to load fixtures');
    } finally {
      setIsLoadingFixtures(false);
    }
  };

  const processFixture = async (fixtureId: string) => {
    setIsProcessing(true);
    setProcessingError(null);
    setProcessingResult(null);
    
    try {
      const response = await apiClient.post<ProcessResponse>('/api/demo/process', {
        image: fixtureId,
        includeVisualization: true,
      });

      if (response.status === 'completed' && response.result) {
        setProcessingResult(response.result);
      } else if (response.status === 'failed') {
        setProcessingError(response.error || 'Processing failed');
      } else {
        // Poll for result
        await pollForResult(response.faxId);
      }
    } catch (error) {
      setProcessingError(error instanceof Error ? error.message : 'Failed to process fax');
    } finally {
      setIsProcessing(false);
    }
  };

  const processUpload = async (file: File) => {
    setIsProcessing(true);
    setProcessingError(null);
    setProcessingResult(null);
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('includeVisualization', 'true');

      const response = await apiClient.postFormData<ProcessResponse>('/api/demo/process', formData);

      if (response.status === 'completed' && response.result) {
        setProcessingResult(response.result);
      } else if (response.status === 'failed') {
        setProcessingError(response.error || 'Processing failed');
      } else {
        // Poll for result
        await pollForResult(response.faxId);
      }
    } catch (error) {
      setProcessingError(error instanceof Error ? error.message : 'Failed to process fax');
    } finally {
      setIsProcessing(false);
    }
  };

  const pollForResult = async (faxId: string, maxAttempts = 30) => {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        const response = await apiClient.get<ProcessResponse>(`/api/demo/result/${faxId}`);
        
        if (response.status === 'completed' && response.result) {
          setProcessingResult(response.result);
          return;
        } else if (response.status === 'failed') {
          setProcessingError(response.error || 'Processing failed');
          return;
        }
      } catch {
        // Continue polling on error
      }
    }
    
    setProcessingError('Processing timeout');
  };

  return {
    fixtures,
    isLoadingFixtures,
    fixturesError,
    fetchFixtures,
    processingResult,
    isProcessing,
    processingError,
    processFixture,
    processUpload,
  };
}
