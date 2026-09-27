'use client';

import React from 'react';
import { RotateCw, Eye, EyeOff, Sparkles, BookOpen } from 'lucide-react';
import { CONFIDENCE_LEVELS, type FlashcardPracticeItem } from '@prep-kit/shared';

interface FlashcardViewProps {
  card: FlashcardPracticeItem;
  isRevealed: boolean;
  onToggleReveal: () => void;
}

export function FlashcardView({ card, isRevealed, onToggleReveal }: FlashcardViewProps) {
  const currentConfidence = card.confidence_score
    ? CONFIDENCE_LEVELS.find((c) => c.score === card.confidence_score)
    : null;

  return (
    <div className="w-full">
      <div
        onClick={onToggleReveal}
        role="button"
        tabIndex={0}
        aria-label={isRevealed ? 'Hide answer' : 'Reveal answer'}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onToggleReveal();
          }
        }}
        className={`relative w-full min-h-[320px] sm:min-h-[360px] rounded-2xl border p-6 sm:p-8 flex flex-col justify-between cursor-pointer transition-all duration-300 shadow-2xl backdrop-blur-md select-none group focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
          isRevealed
            ? 'border-indigo-500/40 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 hover:border-indigo-500/60'
            : 'border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 hover:border-slate-700 hover:shadow-indigo-500/5'
        }`}
      >
        {/* Card Top Metadata Bar */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase font-mono border ${
                isRevealed
                  ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {isRevealed ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              <span>{isRevealed ? 'Answer Revealed' : 'Question / Prompt'}</span>
            </span>

            {card.review_count && card.review_count > 0 ? (
              <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
                Practiced {card.review_count} {card.review_count === 1 ? 'time' : 'times'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-mono text-blue-400 border border-blue-500/20">
                <Sparkles className="h-2.5 w-2.5" />
                <span>New Card</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 group-hover:text-slate-200 transition-colors">
            <RotateCw className="h-3.5 w-3.5 group-hover:rotate-180 transition-transform duration-500" />
            <span className="text-[11px] font-medium hidden sm:inline">
              {isRevealed ? 'Click or Space to hide' : 'Click or Space to reveal'}
            </span>
          </div>
        </div>

        {/* Card Core Content (Front vs Back) */}
        <div className="my-auto py-6 sm:py-8 text-center space-y-4">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-400 font-mono">
              {isRevealed ? 'Explanation / Key Architectural Takeaway' : 'Recall Drill & Prompt'}
            </p>
            <h2 className="text-lg sm:text-2xl font-bold text-white leading-relaxed max-w-2xl mx-auto">
              {card.front}
            </h2>
          </div>

          {/* Revealed Answer Box */}
          {isRevealed ? (
            <div className="animate-in fade-in zoom-in-95 duration-200 mt-6 rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-5 sm:p-6 text-left max-w-2xl mx-auto shadow-inner">
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-indigo-300 uppercase tracking-wider font-mono">
                <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
                <span>Verified Concept Answer</span>
              </div>
              <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-normal whitespace-pre-line">
                {card.back}
              </p>
            </div>
          ) : (
            <div className="mt-8">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleReveal();
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 hover:shadow-indigo-500/40 transition-all cursor-pointer"
              >
                <Eye className="h-4 w-4" />
                <span>Reveal Answer</span>
                <kbd className="hidden sm:inline-block ml-1 rounded bg-indigo-700 px-1.5 py-0.5 text-[10px] font-mono text-indigo-200">
                  Space
                </kbd>
              </button>
            </div>
          )}
        </div>

        {/* Card Footer: Requirements & Past Rating */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-medium">Requirements:</span>
            {(card.requirement_ids || []).map((rId) => (
              <span
                key={rId}
                className="rounded bg-indigo-950/80 px-2 py-0.5 font-mono text-[10px] text-indigo-300 border border-indigo-800/40"
              >
                {rId}
              </span>
            ))}
          </div>

          {currentConfidence && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-medium">Prior Rating:</span>
              <span
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium border ${currentConfidence.bgColor} ${currentConfidence.textColor} ${currentConfidence.borderColor}`}
              >
                <span>{currentConfidence.label}</span>
                <span className="opacity-70">({currentConfidence.score}/5)</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
