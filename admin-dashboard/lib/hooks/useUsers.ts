import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export function useUsers(params?: {
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: async () => {
      const response = await apiClient.get('/admin/users', { params });
      return response.data;
    },
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: async () => {
      const response = await apiClient.get(`/admin/users/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useUserActivity(id: string, limit: number = 50) {
  return useQuery({
    queryKey: ['users', id, 'activity'],
    queryFn: async () => {
      const response = await apiClient.get(`/admin/users/${id}/activity`, {
        params: { limit },
      });
      return response.data;
    },
    enabled: !!id,
  });
}

export function useUserOrders(id: string) {
  return useQuery({
    queryKey: ['users', id, 'orders'],
    queryFn: async () => {
      const response = await apiClient.get(`/admin/users/${id}/orders`);
      return response.data;
    },
    enabled: !!id,
  });
}
