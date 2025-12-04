'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface ProcessingStatusProps {
  isProcessing: boolean;
}

const processingSteps = [
  { id: 1, label: 'Receiving fax image', duration: 500 },
  { id: 2, label: 'Analyzing image with AI Vision', duration: 2000 },
  { id: 3, label: 'Extracting text (OCR)', duration: 1500 },
  { id: 4, label: 'Detecting visual annotations', duration: 1000 },
  { id: 5, label: 'Classifying intent', duration: 1000 },
  { id: 6, label: 'Generating response', duration: 500 },
];

export function ProcessingStatus({ isProcessing }: ProcessingStatusProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!isProcessing) {
      setCurrentStep(0);
      setProgress(0);
      setElapsedTime(0);
      return;
    }

    // Simulate processing steps
    let stepIndex = 0;

    const advanceStep = () => {
      if (stepIndex < processingSteps.length) {
        setCurrentStep(stepIndex + 1);
        setProgress(((stepIndex + 1) / processingSteps.length) * 100);
        
        if (stepIndex < processingSteps.length - 1) {
          stepIndex++;
          setTimeout(advanceStep, processingSteps[stepIndex - 1].duration);
        }
      }
    };

    advanceStep();

    // Update elapsed time
    const timeInterval = setInterval(() => {
      setElapsedTime((prev) => prev + 100);
    }, 100);

    return () => {
      clearInterval(timeInterval);
    };
  }, [isProcessing]);

  if (!isProcessing) {
    return null;
  }

  const estimatedTotal = processingSteps.reduce((sum, step) => sum + step.duration, 0);
  const estimatedRemaining = Math.max(0, estimatedTotal - elapsedTime);

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Processing Fax...</h3>
            <div className="text-sm text-muted-foreground">
              {(elapsedTime / 1000).toFixed(1)}s elapsed
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Processing steps */}
          <div className="space-y-3">
            {processingSteps.map((step, index) => {
              const isComplete = index < currentStep;
              const isCurrent = index === currentStep - 1;
              const isPending = index >= currentStep;

              return (
                <div
                  key={step.id}
                  className={`flex items-center space-x-3 transition-opacity ${
                    isPending ? 'opacity-40' : 'opacity-100'
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                      isComplete
                        ? 'bg-green-500'
                        : isCurrent
                        ? 'bg-primary'
                        : 'bg-gray-300'
                    }`}
                  >
                    {isComplete ? (
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        role="img"
                        aria-label="Completed"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : isCurrent ? (
                      <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                    ) : (
                      <div className="w-2 h-2 bg-white rounded-full" />
                    )}
                  </div>
                  <span
                    className={`text-sm ${
                      isCurrent ? 'font-medium' : 'font-normal'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Loading animation */}
          <div className="flex justify-center pt-4">
            <div className="flex space-x-2">
              <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
