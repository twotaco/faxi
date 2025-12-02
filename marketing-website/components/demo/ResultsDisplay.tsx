'use client';

import { ProcessingResult } from '@/lib/api/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';

interface ResultsDisplayProps {
  result: ProcessingResult;
}

export function ResultsDisplay({ result }: ResultsDisplayProps) {
  const {
    extractedText,
    annotations,
    intent,
    confidence,
    processingTime,
    visualizationData,
    generatedResponse,
  } = result;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Processing Results</h2>
        <p className="text-muted-foreground">
          AI analysis complete - see what Faxi detected in your fax
        </p>
      </div>

      {/* Summary Card */}
      <Card className="border-green-500 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-900">✓ Processing Complete</CardTitle>
          <CardDescription className="text-green-700">
            Processed in {(processingTime / 1000).toFixed(2)}s with{' '}
            {(confidence * 100).toFixed(1)}% confidence
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Visualization */}
      {visualizationData.annotatedImageUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Visual Analysis</CardTitle>
            <CardDescription>
              Detected regions and annotations highlighted
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative w-full h-96 bg-gray-100 rounded overflow-hidden">
              <Image
                src={visualizationData.annotatedImageUrl}
                alt={`Annotated fax image showing ${visualizationData.regions.length} detected regions including text, annotations, and form fields`}
                fill
                className="object-contain"
                loading="lazy"
              />
            </div>
            {visualizationData.regions.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">Detected Regions:</p>
                <div className="flex flex-wrap gap-2">
                  {visualizationData.regions.map((region, index) => (
                    <div
                      key={index}
                      className="inline-flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-full text-sm"
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: region.color || '#666' }}
                      />
                      <span>
                        {region.label} ({(region.confidence * 100).toFixed(0)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Extracted Text */}
      <Card>
        <CardHeader>
          <CardTitle>Extracted Text (OCR)</CardTitle>
          <CardDescription>
            Text recognized from the fax image
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap">
            {extractedText || 'No text detected'}
          </div>
        </CardContent>
      </Card>

      {/* Annotations */}
      {annotations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Visual Annotations</CardTitle>
            <CardDescription>
              Hand-drawn marks detected on the fax
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {annotations.map((annotation, index) => (
                <div
                  key={index}
                  className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div
                    className="flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: annotation.color || '#666' }}
                  >
                    {annotation.type === 'checkmark' && '✓'}
                    {annotation.type === 'circle' && '○'}
                    {annotation.type === 'arrow' && '→'}
                    {annotation.type === 'underline' && '_'}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium capitalize">{annotation.type}</p>
                    {annotation.associatedText && (
                      <p className="text-sm text-muted-foreground">
                        Near: &ldquo;{annotation.associatedText}&rdquo;
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Confidence: {(annotation.confidence * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Fax Response */}
      {generatedResponse && (
        <Card className="border-green-600 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-900">📠 Faxi&apos;s Response</CardTitle>
            <CardDescription className="text-green-700">
              This is what Faxi would fax back to the user
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-white border-2 border-dashed border-green-300 rounded-lg p-6">
                <div className="text-center text-xs text-gray-400 mb-4 pb-2 border-b border-gray-200">
                  ━━━ FAX RESPONSE ━━━
                </div>
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 leading-relaxed">
                  {generatedResponse.faxContent}
                </pre>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-100 rounded-lg p-3 flex-1">
                  <span className="font-semibold">Action taken:</span>
                  <span>{generatedResponse.actionTaken}</span>
                </div>
                {generatedResponse.responsePdfUrl && (
                  <button
                    onClick={() => {
                      // Convert data URL to blob and trigger download
                      const dataUrl = generatedResponse.responsePdfUrl;
                      if (dataUrl && dataUrl.startsWith('data:')) {
                        const [header, base64] = dataUrl.split(',');
                        const mimeMatch = header.match(/data:([^;]+)/);
                        const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
                        const byteCharacters = atob(base64);
                        const byteNumbers = new Array(byteCharacters.length);
                        for (let i = 0; i < byteCharacters.length; i++) {
                          byteNumbers[i] = byteCharacters.charCodeAt(i);
                        }
                        const byteArray = new Uint8Array(byteNumbers);
                        const blob = new Blob([byteArray], { type: mimeType });
                        const url = URL.createObjectURL(blob);
                        window.open(url, '_blank');
                        // Clean up after a delay
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    View PDF
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Intent Classification */}
      <Card>
        <CardHeader>
          <CardTitle>Identified Intent</CardTitle>
          <CardDescription>
            What the user wants to accomplish
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-primary/10 rounded-lg">
              <p className="font-semibold text-lg mb-2">Primary Intent</p>
              <p className="text-2xl font-bold text-primary">{intent.primary}</p>
              <p className="text-sm text-muted-foreground mt-2">
                Confidence: {(intent.confidence * 100).toFixed(1)}%
              </p>
            </div>

            {intent.secondary && intent.secondary.length > 0 && (
              <div>
                <p className="font-medium mb-2">Alternative Intents:</p>
                <div className="space-y-2">
                  {intent.secondary.map((alt, index) => (
                    <div
                      key={index}
                      className="px-3 py-2 bg-gray-100 rounded text-sm"
                    >
                      {alt}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(intent.parameters).length > 0 && (
              <div>
                <p className="font-medium mb-2">Extracted Parameters:</p>
                <div className="bg-gray-50 rounded-lg p-4">
                  <pre className="text-sm overflow-x-auto">
                    {JSON.stringify(intent.parameters, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Confidence Scores */}
      <Card>
        <CardHeader>
          <CardTitle>AI Confidence Breakdown</CardTitle>
          <CardDescription>
            Detailed confidence scores for each processing stage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Confidence</span>
                <span className="font-medium">{(confidence * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary h-full rounded-full transition-all"
                  style={{ width: `${confidence * 100}%` }}
                />
              </div>
            </div>

            {annotations.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Annotation Detection</span>
                  <span className="font-medium">
                    {(
                      (annotations.reduce((sum, a) => sum + a.confidence, 0) /
                        annotations.length) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-full rounded-full transition-all"
                    style={{
                      width: `${
                        (annotations.reduce((sum, a) => sum + a.confidence, 0) /
                          annotations.length) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Intent Classification</span>
                <span className="font-medium">
                  {(intent.confidence * 100).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all"
                  style={{ width: `${intent.confidence * 100}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Processing Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-primary">
                {(processingTime / 1000).toFixed(2)}s
              </p>
              <p className="text-sm text-muted-foreground">Processing Time</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-primary">
                {(confidence * 100).toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground">Confidence</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-primary">
                {annotations.length}
              </p>
              <p className="text-sm text-muted-foreground">Annotations</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-primary">
                {visualizationData.regions.length}
              </p>
              <p className="text-sm text-muted-foreground">Regions</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
