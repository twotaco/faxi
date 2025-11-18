import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/client';

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: dashboardApi.getMetrics,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
