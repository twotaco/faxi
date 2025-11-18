'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '../api/client';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'support' | 'analyst';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = () => {
      try {
        const storedUser = localStorage.getItem('admin_user');
        const token = localStorage.getItem('admin_access_token');

        if (storedUser && token) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Failed to load user from storage:', error);
        localStorage.removeItem('admin_user');
        localStorage.removeItem('admin_access_token');
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const data = await authApi.login(email, password);

      // Store token and user
      localStorage.setItem('admin_access_token', data.accessToken);
      localStorage.setItem('admin_user', JSON.stringify(data.user));

      setUser(data.user);

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error: any) {
      // Re-throw with user-friendly message
      const message = error.response?.data?.message || 'Login failed. Please try again.';
      throw new Error(message);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage regardless of API call success
      localStorage.removeItem('admin_access_token');
      localStorage.removeItem('admin_user');
      setUser(null);

      // Redirect to login
      router.push('/login');
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}
