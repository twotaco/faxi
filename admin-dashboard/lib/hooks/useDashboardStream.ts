import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface StreamData {
  type: 'connected' | 'metrics' | 'alert';
  timestamp: string;
  data?: any;
}

export function useDashboardStream() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const connect = useCallback(() => {
    const token = localStorage.getItem('admin_access_token');
    if (!token) {
      setError('No authentication token');
      return null;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    
    // Note: EventSource doesn't support custom headers
    // We'll need to pass the token as a query parameter or use a different approach
    // For now, we'll rely on cookies for authentication
    const eventSource = new EventSource(`${apiUrl}/admin/dashboard/stream`, {
      withCredentials: true,
    });

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      console.log('SSE connection established');
    };

    eventSource.onmessage = (event) => {
      try {
        const data: StreamData = JSON.parse(event.data);
        setLastUpdate(new Date());

        if (data.type === 'connected') {
          console.log('SSE connected:', data.timestamp);
        } else if (data.type === 'metrics') {
          // Update the dashboard metrics cache
          queryClient.setQueryData(['dashboard', 'metrics'], (oldData: any) => {
            if (!oldData) return oldData;
            
            return {
              ...oldData,
              timestamp: data.timestamp,
              health: {
                ...oldData.health,
                status: data.data.health,
                services: data.data.services,
              },
              jobs: {
                ...oldData.jobs,
                active: data.data.activeJobs,
              },
              queue: {
                ...oldData.queue,
                total: data.data.queueSize,
              },
              errors: {
                ...oldData.errors,
                count: data.data.errorCount,
              },
              system: {
                ...oldData.system,
                memoryUsage: {
                  ...oldData.system?.memoryUsage,
                  percentage: data.data.memoryUsage,
                },
              },
            };
          });
        } else if (data.type === 'alert') {
          // Handle alerts (could show a toast notification)
          console.log('Alert received:', data.data);
          // TODO: Show toast notification
        }
      } catch (err) {
        console.error('Failed to parse SSE data:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      setIsConnected(false);
      setError('Connection lost');
      eventSource.close();
    };

    return eventSource;
  }, [queryClient]);

  useEffect(() => {
    const eventSource = connect();

    return () => {
      if (eventSource) {
        eventSource.close();
        setIsConnected(false);
      }
    };
  }, [connect]);

  return {
    isConnected,
    lastUpdate,
    error,
    reconnect: connect,
  };
}
