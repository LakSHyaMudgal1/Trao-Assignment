'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/auth-context';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function LoginPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await login(email, password);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to connect to server';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900/90 p-8 shadow-2xl">
        <div className="text-center mb-6">
          <CardTitle className="text-2xl font-bold text-white">Sign In</CardTitle>
          <p className="mt-1 text-xs text-slate-400">
            Access your personalized interview preparation kits
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-400"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              placeholder="engineer@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>

          <Button
            type="submit"
            isLoading={isLoading}
            className="w-full mt-2"
            size="md"
          >
            Sign In
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          Do not have an account?{' '}
          <Link
            href="/register"
            className="font-semibold text-indigo-400 hover:text-indigo-300 focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
          >
            Create one
          </Link>
        </div>
      </Card>
    </div>
  );
}
