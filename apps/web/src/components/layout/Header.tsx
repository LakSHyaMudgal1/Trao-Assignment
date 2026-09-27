'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, Sparkles, Plus, LayoutDashboard, LogOut, Terminal } from 'lucide-react';
import { useAuth } from '../../context/auth-context';

export function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-base font-bold tracking-tight text-white hover:text-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090d16] rounded-lg p-1 transition-colors"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-mono font-black text-xs shadow-md shadow-indigo-600/30 border border-indigo-400/30">
              TK
            </span>
            <span className="tracking-tight">
              PrepKit<span className="text-indigo-400 font-mono text-sm">.ai</span>
            </span>
          </Link>

          <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-1">
            <Link
              href="/dashboard"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090d16] ${
                pathname === '/dashboard'
                  ? 'bg-slate-800 text-white border border-slate-700/80 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/new"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090d16] ${
                pathname === '/dashboard/new'
                  ? 'bg-slate-800 text-white border border-slate-700/80 shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              Generate New Kit
            </Link>
            <Link
              href="/#architecture"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800/60 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              Architecture
            </Link>
          </nav>
        </div>

        {/* Desktop User / Auth dock */}
        <div className="hidden sm:flex items-center gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-900/90 px-3 py-1 text-xs text-slate-300 border border-slate-800 font-mono shadow-sm">
                {user.email}
              </span>
              <button
                onClick={() => logout()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 shadow-sm"
              >
                <LogOut className="h-3 w-3" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="rounded-lg px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800/80 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-950/50 hover:bg-indigo-500 border border-indigo-500/40 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                Create Account
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex sm:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
          className="sm:hidden border-b border-slate-800 bg-[#090d16] px-4 pt-3 pb-5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <nav className="space-y-1">
            <Link
              href="/dashboard"
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname === '/dashboard'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-4 w-4 text-indigo-400" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/dashboard/new"
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                pathname === '/dashboard/new'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Plus className="h-4 w-4 text-indigo-400" />
              <span>Generate New Kit</span>
            </Link>
            <Link
              href="/#architecture"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800/60 hover:text-white transition-colors"
            >
              <Terminal className="h-4 w-4 text-indigo-400" />
              <span>Architecture</span>
            </Link>
          </nav>

          <div className="pt-3 border-t border-slate-800/80">
            {isAuthenticated && user ? (
              <div className="space-y-2">
                <p className="px-3 text-xs font-mono text-slate-400 truncate">{user.email}</p>
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  className="flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors text-center"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors text-center shadow-sm"
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
