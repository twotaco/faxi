import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Create axios instance
export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for cookies
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from localStorage
    const token = localStorage.getItem('admin_access_token');
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh the token
        const response = await axios.post(
          `${API_URL}/admin/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const { accessToken } = response.data;

        // Store new token
        localStorage.setItem('admin_access_token', accessToken);

        // Retry original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear auth and redirect to login
        localStorage.removeItem('admin_access_token');
        localStorage.removeItem('admin_user');
        
        // Only redirect if we're in the browser
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API functions
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await apiClient.post('/admin/auth/login', { email, password });
    return response.data;
  },

  logout: async () => {
    const response = await apiClient.post('/admin/auth/logout');
    return response.data;
  },

  refresh: async () => {
    const response = await apiClient.post('/admin/auth/refresh');
    return response.data;
  },
};

// Dashboard API functions
export const dashboardApi = {
  getMetrics: async () => {
    const response = await apiClient.get('/admin/dashboard/metrics');
    return response.data;
  },

  // SSE connection for real-time updates
  createEventSource: (onMessage: (data: any) => void, onError?: (error: any) => void) => {
    const token = localStorage.getItem('admin_access_token');
    const url = `${API_URL}/admin/dashboard/stream`;
    
    // Note: EventSource doesn't support custom headers, so we'll need to pass token as query param
    // or use a different approach for SSE authentication
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Failed to parse SSE data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      if (onError) {
        onError(error);
      }
    };

    return eventSource;
  },
};

// Jobs API functions
export const jobsApi = {
  list: async (params?: {
    status?: string;
    user?: string;
    intent?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await apiClient.get('/admin/jobs', { params });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await apiClient.get(`/admin/jobs/${id}`);
    return response.data;
  },

  retry: async (id: string) => {
    const response = await apiClient.post(`/admin/jobs/${id}/retry`);
    return response.data;
  },

  cancel: async (id: string) => {
    const response = await apiClient.post(`/admin/jobs/${id}/cancel`);
    return response.data;
  },
};

export default apiClient;
