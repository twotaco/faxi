import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ordersApi } from '../api/client';

export function usePendingOrders(params?: {
  sortBy?: 'date' | 'price' | 'user';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  search?: string;
}) {
  return useQuery({
    queryKey: ['orders', 'pending', params],
    queryFn: () => ordersApi.listPending(params),
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: () => ordersApi.getById(id),
    enabled: !!id,
  });
}

export function usePrepareCheckout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ordersApi.prepareCheckout(id),
    onSuccess: (_, id) => {
      // Invalidate order queries to refetch
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      queryClient.invalidateQueries({ queryKey: ['orders', 'pending'] });
    },
  });
}

export function useCompletePurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { amazonOrderId: string; actualPrice: number } }) =>
      ordersApi.completePurchase(id, data),
    onSuccess: (_, { id }) => {
      // Invalidate order queries to refetch
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      queryClient.invalidateQueries({ queryKey: ['orders', 'pending'] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      ordersApi.cancel(id, reason),
    onSuccess: (_, { id }) => {
      // Invalidate order queries to refetch
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      queryClient.invalidateQueries({ queryKey: ['orders', 'pending'] });
    },
  });
}
