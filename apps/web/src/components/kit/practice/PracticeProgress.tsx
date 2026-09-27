'use client';

import React from 'react';
import { CheckCircle2, Clock, Layers, BarChart3 } from 'lucide-react';
import { Card } from '../../ui/Card';

interface PracticeProgressProps {
  currentIndex: number;
  totalCards: number;
  coveredCount: number;
  uncoveredCount: number;
  ratingsSummary?: { [score: number]: number };
}

export function PracticeProgress({
  currentIndex,
  totalCards,
  coveredCount,
  uncoveredCount,
  ratingsSummary = {},
}: PracticeProgressProps) {
  const percentComplete = totalCards > 0 ? Math.round((currentIndex / totalCards) * 100) : 0;
  const coveredPercent = totalCards > 0 ? Math.round((coveredCount / totalCards) * 100) : 0;

  return (
    <div className="w-full space-y-3">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Current Card Position */}
        <Card className="p-3.5 bg-slate-900/60 border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Session Card</p>
              <p className="text-sm sm:text-base font-bold text-white">
                {currentIndex + 1} <span className="text-xs text-slate-500 font-normal">of {totalCards}</span>
              </p>
            </div>
          </div>
        </Card>

        {/* Covered Count */}
        <Card className="p-3.5 bg-slate-900/60 border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Covered</p>
              <p className="text-sm sm:text-base font-bold text-emerald-400">
                {coveredCount} <span className="text-xs text-slate-500 font-normal">({coveredPercent}%)</span>
              </p>
            </div>
          </div>
        </Card>

        {/* Uncovered Count */}
        <Card className="p-3.5 bg-slate-900/60 border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium">Uncovered</p>
              <p className="text-sm sm:text-base font-bold text-amber-400">
                {uncoveredCount} <span className="text-xs text-slate-500 font-normal">remaining</span>
              </p>
            </div>
          </div>
        </Card>

        {/* Session Distribution */}
        <Card className="p-3.5 bg-slate-900/60 border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div className="truncate">
              <p className="text-[11px] text-slate-400 font-medium">Session Ratings</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {[1, 2, 3, 4, 5].map((score) => {
                  const count = ratingsSummary[score] || 0;
                  return (
                    <span
                      key={score}
                      title={`Score ${score}: ${count} card(s)`}
                      className={`font-mono text-[11px] px-1 rounded ${
                        count > 0 ? 'bg-slate-800 text-slate-200 font-bold' : 'text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Visual Linear Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Session Progress</span>
          <span className="font-mono text-indigo-400 font-semibold">{percentComplete}% Complete</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/80 p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-300"
            style={{ width: `${Math.max(4, percentComplete)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
