'use client';

import React from 'react';
import { CONFIDENCE_LEVELS, type ConfidenceScore } from '@prep-kit/shared';
import { Sparkles, HelpCircle } from 'lucide-react';

interface ConfidenceControlsProps {
  isRevealed: boolean;
  onSelectConfidence: (score: ConfidenceScore) => void;
  disabled?: boolean;
}

export function ConfidenceControls({
  isRevealed,
  onSelectConfidence,
  disabled = false,
}: ConfidenceControlsProps) {
  return (
    <div className="w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6 backdrop-blur-sm space-y-4 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span>Select Recall Confidence</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Rates memory retention and deterministically schedules weaker cards earlier in future sessions
          </p>
        </div>

        {!isRevealed && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-400 border border-amber-500/20">
            <HelpCircle className="h-3 w-3" />
            <span>Reveal answer above before rating</span>
          </span>
        )}
      </div>

      {/* 5 Confidence Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {CONFIDENCE_LEVELS.map((level) => {
          const isEnabled = isRevealed && !disabled;

          return (
            <button
              key={level.score}
              type="button"
              disabled={!isEnabled}
              onClick={() => onSelectConfidence(level.score as ConfidenceScore)}
              className={`group relative flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                isEnabled
                  ? `cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${level.bgColor} ${level.borderColor} hover:border-slate-500 hover:shadow-lg`
                  : 'opacity-40 cursor-not-allowed border-slate-800 bg-slate-950 text-slate-500'
              }`}
            >
              {/* Keyboard Shortcut Pill */}
              <span className="absolute top-2 right-2 rounded bg-slate-800/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 border border-slate-700">
                {level.keyHint}
              </span>

              <span className={`text-base font-bold mb-0.5 ${isEnabled ? level.textColor : 'text-slate-500'}`}>
                {level.score}
              </span>

              <span className={`text-xs font-semibold ${isEnabled ? 'text-white' : 'text-slate-400'}`}>
                {level.label}
              </span>

              <span className="text-[10px] text-slate-500 mt-1 line-clamp-1 group-hover:line-clamp-none transition-all hidden sm:block">
                {level.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* Keyboard Hint Dock */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 font-mono">
        <span>Shortcuts: Press keys [1] - [5] to rate and advance</span>
        <span>[Space] / [Enter] to toggle answer</span>
      </div>
    </div>
  );
}
