'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { ProtectedRoute } from '../../../../../components/auth/ProtectedRoute';
import { api } from '../../../../../lib/api-client';
import {
  sortCardsForPractice,
  isCardCovered,
  type ConfidenceScore,
  type FlashcardPracticeItem,
} from '@prep-kit/shared';
import { FlashcardView } from '../../../../../components/kit/practice/FlashcardView';
import { ConfidenceControls } from '../../../../../components/kit/practice/ConfidenceControls';
import { PracticeProgress } from '../../../../../components/kit/practice/PracticeProgress';
import { CompletionSummary } from '../../../../../components/kit/practice/CompletionSummary';

export default function PracticeModePage() {
  const params = useParams();
  const router = useRouter();
  const kitId = params.id as string;

  const [kit, setKit] = useState<any | null>(null);
  const [deck, setDeck] = useState<FlashcardPracticeItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Session stats tracking
  const [sessionRatings, setSessionRatings] = useState<{ [score: number]: number }>({
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  });
  const [coveredCardIds, setCoveredCardIds] = useState<Set<string>>(new Set());

  // 1. Load Kit and initialize deterministic priority ordering
  const initPracticeDeck = useCallback((flashcards: FlashcardPracticeItem[]) => {
    // Sort by: 1. never practiced, 2. lowest confidence, 3. oldest review
    const sorted = sortCardsForPractice(flashcards);
    setDeck(sorted);
    setCurrentIndex(0);
    setIsRevealed(false);
    setIsCompleted(false);

    // Initial covered set based on persisted records
    const initialCovered = new Set<string>();
    for (const card of flashcards) {
      if (isCardCovered(card)) {
        initialCovered.add(card.id);
      }
    }
    setCoveredCardIds(initialCovered);
  }, []);

  const loadKit = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await api.getKit(kitId);
      setKit(data);
      initPracticeDeck(data.flashcards || []);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load preparation kit.');
    } finally {
      setIsLoading(false);
    }
  }, [kitId, initPracticeDeck]);

  useEffect(() => {
    loadKit();
  }, [loadKit]);

  const activeCard = deck[currentIndex];

  // 2. Confidence Selection & Persistence
  const handleSelectConfidence = useCallback(
    async (score: ConfidenceScore) => {
      if (!activeCard || isCompleted) return;

      const cardId = activeCard.id;

      // Update session statistics
      setSessionRatings((prev) => ({
        ...prev,
        [score]: (prev[score] || 0) + 1,
      }));

      // Mark as covered in session
      setCoveredCardIds((prev) => new Set([...prev, cardId]));

      // Update card in local deck
      const updatedDeck = deck.map((c) =>
        c.id === cardId
          ? {
              ...c,
              confidence_score: score,
              last_reviewed_at: new Date().toISOString(),
              review_count: (c.review_count || 0) + 1,
              is_covered: true,
            }
          : c
      );
      setDeck(updatedDeck);

      // Persist to backend API asynchronously (never blocks the user experience)
      try {
        await api.recordFlashcardReview(kitId, cardId, score);
      } catch (err) {
        console.error('Failed to persist flashcard review to server:', err);
      }

      // Advance to next card or complete session
      if (currentIndex < deck.length - 1) {
        setCurrentIndex((prev) => prev + 1);
        setIsRevealed(false);
      } else {
        setIsCompleted(true);
      }
    },
    [activeCard, isCompleted, deck, currentIndex, kitId]
  );

  // 3. Navigation Controls
  const handlePreviousCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsRevealed(false);
    }
  };

  const handleSkipCard = () => {
    if (currentIndex < deck.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsRevealed(false);
    } else {
      setIsCompleted(true);
    }
  };

  const handleRestartFullSession = () => {
    // Re-run deterministic sorting so lower confidence cards appear first
    initPracticeDeck(deck);
    setSessionRatings({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  };

  const handleReviewWeakOnly = () => {
    const weakCards = deck.filter((c) => (c.confidence_score ?? 1) <= 2);
    if (weakCards.length > 0) {
      const sortedWeak = sortCardsForPractice(weakCards);
      setDeck(sortedWeak);
      setCurrentIndex(0);
      setIsRevealed(false);
      setIsCompleted(false);
    }
  };

  // 4. Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Completion screen shortcuts
      if (isCompleted) {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleRestartFullSession();
        }
        return;
      }

      // Space / Enter or ArrowDown: Reveal or flip answer
      if (e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsRevealed((prev) => !prev);
        return;
      }

      // Numbers 1-5: Rate confidence
      if (['1', '2', '3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        const score = parseInt(e.key, 10) as ConfidenceScore;
        // If answer was hidden, auto-reveal and rate
        if (!isRevealed) {
          setIsRevealed(true);
        }
        handleSelectConfidence(score);
        return;
      }

      // ArrowLeft: Previous card
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePreviousCard();
        return;
      }

      // ArrowRight: Skip to next card
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSkipCard();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCompleted, isRevealed, handleSelectConfidence, currentIndex, deck.length]);

  // Loading state
  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <div className="inline-flex h-12 w-12 animate-spin items-center justify-center rounded-full border-4 border-indigo-500 border-t-transparent mb-4" />
          <h2 className="text-lg font-semibold text-slate-200">Initializing Practice Mode...</h2>
          <p className="text-xs text-slate-500 mt-1">Sorting cards by confidence weight & review history</p>
        </div>
      </ProtectedRoute>
    );
  }

  // Error state
  if (loadError || !kit) {
    return (
      <ProtectedRoute>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-4">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-white">Kit Not Found</h2>
          <p className="text-sm text-slate-400 mt-2">{loadError || 'Unable to open practice mode.'}</p>
          <div className="mt-6 flex justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // Empty deck state
  if (deck.length === 0) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-center items-center px-4 py-12">
          <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
            <BookOpen className="h-10 w-10 text-slate-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white">No Flashcards Available</h2>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
              This kit does not have any flashcards yet. Visit the kit editor to generate or add custom recall cards.
            </p>
            <div className="mt-6">
              <Link
                href={`/dashboard/kits/${kitId}`}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Return to Kit Builder</span>
              </Link>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  const totalDeckSize = deck.length;
  const coveredCount = coveredCardIds.size;
  const uncoveredCount = Math.max(0, totalDeckSize - coveredCount);
  const weakCount = deck.filter((c) => (c.confidence_score ?? 1) <= 2).length;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between">
        {/* Top Header Dock */}
        <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090d16]/90 backdrop-blur-md">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="flex h-16 items-center justify-between gap-4">
              <div className="flex items-center gap-3 truncate">
                <Link
                  href={`/dashboard/kits/${kitId}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors shrink-0"
                  title="Exit to Kit Builder"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>

                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-mono text-indigo-400 border border-indigo-500/20 font-semibold uppercase">
                      Practice Mode
                    </span>
                    <h1 className="text-sm sm:text-base font-bold text-white truncate">
                      {kit.source?.company || 'Interview Kit'}
                    </h1>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    {kit.role?.title || 'Engineer'} • {totalDeckSize} Recall Cards
                  </p>
                </div>
              </div>

              {/* Action: Exit Link */}
              <div className="flex items-center gap-2">
                <Link
                  href={`/dashboard/kits/${kitId}`}
                  className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  Exit Practice
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="mx-auto max-w-4xl w-full px-4 sm:px-6 py-6 sm:py-8 flex-1 flex flex-col justify-center">
          {isCompleted ? (
            /* Mode B: Completion Summary */
            <CompletionSummary
              kitId={kitId}
              kitTitle={kit.title || `${kit.source?.company} Kit`}
              totalCards={deck.length}
              ratingsSummary={sessionRatings}
              weakCardCount={weakCount}
              onRestartFullSession={handleRestartFullSession}
              onReviewWeakOnly={weakCount > 0 ? handleReviewWeakOnly : undefined}
            />
          ) : (
            /* Mode A: Active Practice Carousel */
            <div className="space-y-6">
              {/* Progress & Counts Indicator */}
              <PracticeProgress
                currentIndex={currentIndex}
                totalCards={totalDeckSize}
                coveredCount={coveredCount}
                uncoveredCount={uncoveredCount}
                ratingsSummary={sessionRatings}
              />

              {/* Flashcard (One at a time, initially hidden answer) */}
              {activeCard && (
                <FlashcardView
                  card={activeCard}
                  isRevealed={isRevealed}
                  onToggleReveal={() => setIsRevealed(!isRevealed)}
                />
              )}

              {/* Confidence Selection Controls (1 to 5) */}
              <ConfidenceControls
                isRevealed={isRevealed}
                onSelectConfidence={handleSelectConfidence}
              />

              {/* Bottom Quick Navigation */}
              <div className="flex items-center justify-between text-xs text-slate-400 px-1 pt-1">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={handlePreviousCard}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 hover:bg-slate-800 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Previous</span>
                  <kbd className="rounded bg-slate-800 px-1 py-0.2 font-mono text-[10px] text-slate-500">
                    ←
                  </kbd>
                </button>

                <span className="font-mono text-[11px] text-slate-500">
                  Prioritizing: Never Practiced → Lowest Confidence → Oldest Review
                </span>

                <button
                  type="button"
                  onClick={handleSkipCard}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  <span>Skip</span>
                  <kbd className="rounded bg-slate-800 px-1 py-0.2 font-mono text-[10px] text-slate-500">
                    →
                  </kbd>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Global Keyboard Shortcut Helper Footer */}
        <footer className="border-t border-slate-800/60 bg-slate-950/80 py-2.5 px-4 text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-slate-500 font-mono">
            <span>
              <kbd className="rounded bg-slate-800 px-1 py-0.5 text-slate-300">Space</kbd> Flip Answer
            </span>
            <span>•</span>
            <span>
              <kbd className="rounded bg-slate-800 px-1 py-0.5 text-slate-300">1</kbd> -{' '}
              <kbd className="rounded bg-slate-800 px-1 py-0.5 text-slate-300">5</kbd> Confidence
            </span>
            <span>•</span>
            <span>
              <kbd className="rounded bg-slate-800 px-1 py-0.5 text-slate-300">←</kbd> /{' '}
              <kbd className="rounded bg-slate-800 px-1 py-0.5 text-slate-300">→</kbd> Nav
            </span>
          </div>
        </footer>
      </div>
    </ProtectedRoute>
  );
}
