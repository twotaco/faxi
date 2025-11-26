'use client';

import { useState } from 'react';
import { useMetrics } from '@/lib/hooks/useMetrics';
import { AccuracyMetrics } from './AccuracyMetrics';
import { ProcessingStatistics } from './ProcessingStatistics';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface MetricsDashboardProps {
  refreshInterval?: number; // in milliseconds, default 30000 (30 seconds)
}

export function MetricsDashboard({ refreshInterval = 30000 }: MetricsDashboardProps) {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { 
    accuracyMetrics, 
    processingStats, 
    isLoading, 
    error, 
    lastUpdated,
    refresh 
  } = useMetrics(autoRefresh ? refreshInterval : undefined);

  const handleManualRefresh = () => {
    refresh();
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  const formatLastUpdated = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    
    if (diffSecs < 60) {
      return `${diffSecs} seconds ago`;
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleTimeString();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold">AI Performance Metrics</h2>
          <p className="text-muted-foreground mt-1">
            Real-time accuracy and processing statistics
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            Last updated: {formatLastUpdated(lastUpdated)}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={toggleAutoRefresh}
          >
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="p-4 border-destructive">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <div>
              <div className="font-semibold">Failed to load metrics</div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleManualRefresh}
            className="mt-3"
          >
            Try Again
          </Button>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && !accuracyMetrics && !processingStats && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading metrics...</p>
          </div>
        </div>
      )}

      {/* Metrics Content */}
      {accuracyMetrics && (
        <div>
          <h3 className="text-2xl font-bold mb-4">Accuracy Metrics</h3>
          <AccuracyMetrics data={accuracyMetrics} />
        </div>
      )}

      {processingStats && (
        <div>
          <h3 className="text-2xl font-bold mb-4">Processing Statistics</h3>
          <ProcessingStatistics data={processingStats} />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && !accuracyMetrics && !processingStats && (
        <Card className="p-12 text-center">
          <div className="text-muted-foreground">
            <p className="text-lg font-semibold mb-2">No metrics available yet</p>
            <p className="text-sm">
              Try the demo to generate processing metrics!
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
