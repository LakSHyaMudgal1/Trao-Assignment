'use client';

import React from 'react';
import Link from 'next/link';
import {
  Trophy,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../../ui/Card';
import { CONFIDENCE_LEVELS } from '@prep-kit/shared';

interface CompletionSummaryProps {
  kitId: string;
  kitTitle: string;
  totalCards: number;
  ratingsSummary: { [score: number]: number };
  weakCardCount: number;
  onRestartFullSession: () => void;
  onReviewWeakOnly?: () => void;
}

export function CompletionSummary({
  kitId,
  kitTitle,
  totalCards,
  ratingsSummary,
  weakCardCount,
  onRestartFullSession,
  onReviewWeakOnly,
}: CompletionSummaryProps) {
  // Compute overall average score
  let totalScoreSum = 0;
  let totalRatedCount = 0;
  for (let score = 1; score <= 5; score++) {
    const count = ratingsSummary[score] || 0;
    totalScoreSum += score * count;
    totalRatedCount += count;
  }

  const avgScore = totalRatedCount > 0 ? (totalScoreSum / totalRatedCount).toFixed(1) : '5.0';
  const highConfidenceCount = (ratingsSummary[4] || 0) + (ratingsSummary[5] || 0);
  const masteryPercentage = totalCards > 0 ? Math.round((highConfidenceCount / totalCards) * 100) : 100;

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300">
      {/* Hero Trophy Card */}
      <Card className="border-indigo-500/30 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/40 p-8 text-center relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 mb-4">
          <Trophy className="h-8 w-8" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          Practice Session Complete!
        </h1>
        <p className="text-sm text-slate-400 mt-2 max-w-lg mx-auto">
          You have reviewed all <span className="text-white font-semibold">{totalCards} cards</span> for{' '}
          <span className="text-indigo-300 font-semibold">{kitTitle}</span>. Practice ratings have been persisted.
        </p>

        {/* High-level score badges */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400 font-medium">Average Confidence</p>
            <p className="text-2xl font-bold text-indigo-400 mt-1">{avgScore} <span className="text-xs text-slate-500 font-normal">/ 5.0</span></p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400 font-medium">Mastery Rate (Score 4-5)</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{masteryPercentage}%</p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-slate-400 font-medium">Cards Needing Review</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{weakCardCount}</p>
          </div>
        </div>
      </Card>

      {/* Confidence Distribution Breakdown */}
      <Card className="p-6 border-slate-800 bg-slate-900/50 space-y-4">
        <CardHeader className="p-0 pb-3 border-b border-slate-800/80">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
            <span>Recall Distribution Breakdown</span>
            <span className="text-xs font-normal text-slate-500 font-mono">1 = Very Weak → 5 = Very Strong</span>
          </CardTitle>
        </CardHeader>

        <div className="space-y-3 pt-2">
          {CONFIDENCE_LEVELS.map((lvl) => {
            const count = ratingsSummary[lvl.score] || 0;
            const pct = totalRatedCount > 0 ? Math.round((count / totalRatedCount) * 100) : 0;

            return (
              <div key={lvl.score} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold font-mono border ${lvl.bgColor} ${lvl.textColor} ${lvl.borderColor}`}>
                      {lvl.score}
                    </span>
                    <span className="font-semibold text-slate-200">{lvl.label}</span>
                    <span className="text-slate-500 text-[11px] hidden sm:inline">({lvl.description})</span>
                  </div>
                  <span className="font-mono text-slate-400">
                    {count} {count === 1 ? 'card' : 'cards'} ({pct}%)
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      lvl.score === 1
                        ? 'bg-rose-500'
                        : lvl.score === 2
                        ? 'bg-amber-500'
                        : lvl.score === 3
                        ? 'bg-yellow-500'
                        : lvl.score === 4
                        ? 'bg-emerald-500'
                        : 'bg-indigo-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Next Step Action Cards */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
        <Link
          href={`/dashboard/kits/${kitId}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-5 py-3 text-xs sm:text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Kit Builder</span>
        </Link>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {weakCardCount > 0 && onReviewWeakOnly && (
            <button
              type="button"
              onClick={onReviewWeakOnly}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/40 px-5 py-3 text-xs sm:text-sm font-semibold text-amber-300 hover:bg-amber-900/60 hover:text-white transition-colors cursor-pointer"
            >
              <AlertCircle className="h-4 w-4" />
              <span>Drill Weak Cards ({weakCardCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRestartFullSession}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Next Session (Priority Ordering)</span>
            <kbd className="ml-1 rounded bg-indigo-700 px-1.5 py-0.5 text-[10px] font-mono text-indigo-200">
              Enter
            </kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
