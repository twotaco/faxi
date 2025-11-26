export interface DemoFixture {
  id: string;
  name: string;
  description: string;
  category: 'email' | 'shopping' | 'ai-chat' | 'payment';
  thumbnailUrl: string;
  imageUrl: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Annotation {
  type: 'checkmark' | 'circle' | 'arrow' | 'underline';
  boundingBox: BoundingBox;
  associatedText?: string;
  confidence: number;
  color?: string;
}

export interface Intent {
  primary: string;
  secondary?: string[];
  parameters: Record<string, unknown>;
  confidence: number;
}

export interface VisualizationData {
  annotatedImageUrl?: string;
  regions: Array<{
    type: 'text' | 'annotation' | 'form-field' | 'signature';
    boundingBox: BoundingBox;
    label: string;
    confidence: number;
    color?: string;
  }>;
}

export interface ProcessingResult {
  faxId: string;
  extractedText: string;
  annotations: Annotation[];
  intent: Intent;
  confidence: number;
  processingTime: number;
  visualizationData: VisualizationData;
}

export interface ProcessResponse {
  faxId: string;
  status: 'processing' | 'completed' | 'failed';
  result?: ProcessingResult;
  error?: string;
}

export interface AccuracyMetrics {
  overall: number;
  byCategory: {
    ocr: number;
    annotationDetection: number;
    intentClassification: number;
  };
  byUseCase: Array<{
    useCase: string;
    accuracy: number;
    sampleCount: number;
  }>;
  trend: Array<{
    date: string;
    accuracy: number;
  }>;
  lastUpdated?: string;
}

export interface ProcessingStats {
  averageTime: number;
  medianTime?: number;
  p95Time?: number;
  successRate: number;
  totalProcessed: number;
  confidenceDistribution: Array<{
    range: string;
    count: number;
    percentage?: number;
  }>;
  byUseCase?: Array<{
    useCase: string;
    avgTime: number;
    successRate: number;
  }>;
}
