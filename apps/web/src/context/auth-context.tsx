'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  const refreshSession = useCallback(async () => {
    try {
      // Send HTTP-only cookie automatically with credentials: 'include'
      // Also attach localStorage fallback token if present
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE}/api/auth/me`, {
        method: 'GET',
        headers,
        credentials: 'include',
      });

      if (res.ok) {
        const body = await res.json();
        setUser(body.data.user);
      } else {
        setUser(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
        }
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial session bootstrap on client mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshSession();
  }, [refreshSession]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || 'Login failed');
      }

      if (body.data?.token) {
        localStorage.setItem('auth_token', body.data.token);
      }
      setUser(body.data.user);
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || 'Registration failed');
      }

      if (body.data?.token) {
        localStorage.setItem('auth_token', body.data.token);
      }
      setUser(body.data.user);
      router.push('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Ignore network errors during logout
    } finally {
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
      }
      setIsLoading(false);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
