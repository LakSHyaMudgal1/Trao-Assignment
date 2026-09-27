'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  Building2,
  Calendar,
  Layers,
  HelpCircle,
  ShieldCheck,
  Trash2,
  ExternalLink,
  ArrowRight,
  Download,
  Search,
  Sparkles,
} from 'lucide-react';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { Card, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { CardSkeleton } from '../../components/ui/Skeleton';
import { api } from '../../lib/api-client';

export default function DashboardPage() {
  const [kits, setKits] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadKits = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getKits();
      setKits(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load kits.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKits();
  }, []);

  const filteredKits = kits.filter((kit) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const company = (kit.source?.company || '').toLowerCase();
    const role = (kit.role?.title || '').toLowerCase();
    return company.includes(q) || role.includes(q);
  });

  const handleDeleteKit = async (id: string, company: string) => {
    if (!confirm(`Are you sure you want to delete the prep kit for ${company}?`)) {
      return;
    }
    try {
      await api.deleteKit(id);
      setKits((prev) => prev.filter((k) => (k._id || k.id) !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleExport = async (e: React.MouseEvent, kitId: string, company: string) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const appendixA = await api.exportAppendixA(kitId);
      const blob = new Blob([JSON.stringify(appendixA, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${company || 'prep-kit'}-appendix-a.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              My Interview Prep Kits
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Manage your tailored company intelligence, question banks, and preparation schedules.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard/new">
              <Button size="md">
                <Plus className="h-4 w-4 mr-1.5" /> Create New Kit
              </Button>
            </Link>
          </div>
        </div>

        {/* Batch Upload Informational Banner */}
        <div className="mt-6 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs text-indigo-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">Batch Evaluation Support:</span>
            <span>Prepare for multiple roles simultaneously via file upload or CLI.</span>
          </div>
          <code className="rounded bg-indigo-950/60 px-2 py-1 text-[11px] font-mono text-indigo-200 border border-indigo-800/40 shrink-0">
            npm run evaluate -- --input cases.json --output kits.json
          </code>
        </div>

        {/* Error Banner */}
        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300 flex items-center justify-between gap-3 shadow-lg shadow-rose-950/20"
          >
            <div className="flex items-center gap-2">
              <span>{error}</span>
            </div>
            <Button size="sm" variant="secondary" onClick={loadKits} className="shrink-0">
              Retry
            </Button>
          </div>
        )}

        {/* Search Bar & Filter Controls */}
        {!isLoading && kits.length > 0 && (
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search kits by company or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-900/80 pl-9 pr-8 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:border-transparent transition-all shadow-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-xs text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  ×
                </button>
              )}
            </div>

            <span className="text-xs font-mono text-slate-500 self-end sm:self-center">
              Showing {filteredKits.length} of {kits.length} kits
            </span>
          </div>
        )}

        {/* Content Area */}
        <div className="mt-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : kits.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-slate-800 bg-slate-900/30">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-400 mb-4">
                <Building2 className="h-6 w-6" />
              </div>
              <CardTitle className="text-base font-semibold text-slate-200">
                No interview prep kits created yet
              </CardTitle>
              <p className="mt-2 max-w-sm text-xs text-slate-400 leading-relaxed">
                Paste a job description and company URL to generate your first verified prep kit with automated research.
              </p>
              <div className="mt-6">
                <Link href="/dashboard/new">
                  <Button size="sm">Create Your First Kit</Button>
                </Link>
              </div>
            </Card>
          ) : filteredKits.length === 0 ? (
            <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-slate-800 bg-slate-900/30">
              <p className="text-sm font-semibold text-slate-300">
                No kits match &ldquo;{searchQuery}&rdquo;
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Try searching for a different company name or role title.
              </p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-4 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                Clear Search
              </button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredKits.map((kit) => {
                const id = kit._id || kit.id;
                const company = kit.source?.company || 'Target Company';
                const roleTitle = kit.role?.title || 'Engineering Role';
                const days = kit.schedule?.days_available || 5;
                const questionsCount = kit.questions?.length || 0;
                const flashcardsCount = kit.flashcards?.length || 0;

                // Calculate coverage
                const reqCount = kit.role?.requirements?.length || 0;
                const coveredReqIds = new Set<string>();
                for (const q of kit.questions || []) {
                  for (const rId of q.requirement_ids || []) {
                    coveredReqIds.add(rId);
                  }
                }
                const coveragePercent =
                  reqCount > 0 ? Math.round((coveredReqIds.size / reqCount) * 100) : 100;

                return (
                  <Card
                    key={id}
                    className="group flex flex-col justify-between border-slate-800/80 bg-slate-950/70 p-5 hover:border-indigo-500/40 transition-all hover:shadow-xl hover:shadow-indigo-950/20"
                  >
                    <div>
                      {/* Card Top: Company & Export/Delete Actions */}
                      <div className="flex items-start justify-between gap-3 border-b border-slate-900 pb-3">
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0 font-bold font-mono text-xs">
                            {company.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <h3 className="font-bold text-white text-sm truncate group-hover:text-indigo-300 transition-colors">
                              {company}
                            </h3>
                            <p className="text-[11px] text-slate-400 truncate">{roleTitle}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleExport(e, id, company)}
                            className="rounded p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Export Appendix A JSON"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteKit(id, company)}
                            className="rounded p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Delete Kit"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Brief Excerpt */}
                      <p className="mt-3 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {kit.company_brief?.summary || kit.company_brief?.what_they_do || 'Company intelligence verified.'}
                      </p>

                      {/* Metrics Pill Grid */}
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-800/50">
                          <div className="flex items-center justify-center gap-1 text-slate-400 text-[10px]">
                            <HelpCircle className="h-3 w-3" />
                            <span>Questions</span>
                          </div>
                          <p className="font-mono text-xs font-bold text-white mt-0.5">{questionsCount}</p>
                        </div>

                        <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-800/50">
                          <div className="flex items-center justify-center gap-1 text-slate-400 text-[10px]">
                            <Layers className="h-3 w-3" />
                            <span>Cards</span>
                          </div>
                          <p className="font-mono text-xs font-bold text-white mt-0.5">{flashcardsCount}</p>
                        </div>

                        <div className="rounded-lg bg-slate-900/60 p-2 border border-slate-800/50">
                          <div className="flex items-center justify-center gap-1 text-slate-400 text-[10px]">
                            <Calendar className="h-3 w-3" />
                            <span>Schedule</span>
                          </div>
                          <p className="font-mono text-xs font-bold text-white mt-0.5">{days}d</p>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Coverage & Link Actions */}
                    <div className="mt-5 flex items-center justify-between border-t border-slate-900 pt-3">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck
                          className={`h-3.5 w-3.5 ${
                            coveragePercent === 100 ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        />
                        <span
                          className={`font-mono text-xs font-semibold ${
                            coveragePercent === 100 ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {coveragePercent}% Covered
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <Link
                          href={`/dashboard/kits/${id}/practice`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-indigo-300 transition-colors"
                          title="Practice Flashcards"
                        >
                          <Sparkles className="h-3 w-3 text-indigo-400" />
                          <span>Practice</span>
                        </Link>
                        <Link
                          href={`/dashboard/kits/${id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 group-hover:translate-x-0.5 transition-transform"
                        >
                          <span>Builder</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
