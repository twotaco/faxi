import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi } from '../api/client';

export function useJobs(params?: {
  status?: string;
  user?: string;
  intent?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () => jobsApi.list(params),
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => jobsApi.getById(id),
    enabled: !!id,
  });
}

export function useRetryJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => jobsApi.retry(id),
    onSuccess: () => {
      // Invalidate jobs queries to refetch
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useCancelJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => jobsApi.cancel(id),
    onSuccess: () => {
      // Invalidate jobs queries to refetch
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
