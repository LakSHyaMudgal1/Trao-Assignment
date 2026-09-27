'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Trash2,
  Layers,
  RotateCw,
  Star,
  Check,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../../ui/Card';
import type { FlashcardItem, RequirementItem } from '@prep-kit/shared';

interface InternalFlashcardItem extends FlashcardItem {
  confidence_score?: number;
  last_reviewed_at?: string;
  review_count?: number;
  is_edited?: boolean;
}

interface FlashcardsSectionProps {
  kitId?: string;
  flashcards: InternalFlashcardItem[];
  requirements: RequirementItem[];
  onChange: (updatedFlashcards: InternalFlashcardItem[]) => void;
  onRecordReview?: (cardId: string, confidence: number) => void;
}

export function FlashcardsSection({
  kitId,
  flashcards,
  requirements,
  onChange,
  onRecordReview,
}: FlashcardsSectionProps) {
  const [viewMode, setViewMode] = useState<'editor' | 'review'>('editor');
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // New card state
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [newReqIds, setNewReqIds] = useState<string[]>([]);

  // Update card field
  const updateCardField = (id: string, updates: Partial<InternalFlashcardItem>) => {
    onChange(
      flashcards.map((f) => (f.id === id ? { ...f, ...updates, is_edited: true } : f))
    );
  };

  const deleteCard = (id: string) => {
    onChange(flashcards.filter((f) => f.id !== id));
  };

  const toggleReqOnCard = (cardId: string, reqId: string) => {
    const card = flashcards.find((c) => c.id === cardId);
    if (!card) return;
    const current = card.requirement_ids;
    let next: string[];
    if (current.includes(reqId)) {
      if (current.length === 1) {
        alert('A flashcard must reference at least one requirement.');
        return;
      }
      next = current.filter((id) => id !== reqId);
    } else {
      next = [...current, reqId];
    }
    updateCardField(cardId, { requirement_ids: next });
  };

  const handleAddCardSubmit = () => {
    if (!newFront.trim() || !newBack.trim()) {
      alert('Please fill out both the card prompt and the answer/concept.');
      return;
    }
    if (newReqIds.length === 0) {
      alert('Please select at least one requirement for this flashcard.');
      return;
    }

    const newCard: InternalFlashcardItem = {
      id: `f_usr_${Date.now()}`,
      front: newFront.trim(),
      back: newBack.trim(),
      requirement_ids: newReqIds,
      confidence_score: undefined,
      review_count: 0,
      is_edited: true,
    };

    onChange([newCard, ...flashcards]);
    setNewFront('');
    setNewBack('');
    setNewReqIds([]);
    setIsAddingCard(false);
  };

  const handleConfidenceRating = (cardId: string, rating: number) => {
    updateCardField(cardId, {
      confidence_score: rating,
      review_count: (flashcards.find((c) => c.id === cardId)?.review_count ?? 0) + 1,
      last_reviewed_at: new Date().toISOString(),
    });

    if (onRecordReview) {
      onRecordReview(cardId, rating);
    }

    // Advance to next card in review mode
    if (activeReviewIndex < flashcards.length - 1) {
      setActiveReviewIndex(activeReviewIndex + 1);
      setIsFlipped(false);
    } else {
      setIsFlipped(false);
    }
  };

  const activeCard = flashcards[activeReviewIndex];

  return (
    <div className="space-y-6" id="section-flashcards">
      {/* View Switcher Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-semibold text-white">
            Spaced Repetition Flashcards ({flashcards.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Rapid active-recall drills for core distributed architectures and interview concepts
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('editor')}
              className={`rounded px-3 py-1 text-xs font-medium cursor-pointer transition-colors ${
                viewMode === 'editor'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Card Editor
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('review');
                setIsFlipped(false);
              }}
              className={`rounded px-3 py-1 text-xs font-medium cursor-pointer transition-colors ${
                viewMode === 'review'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Study Mode
            </button>
          </div>

          {viewMode === 'editor' && (
            <button
              type="button"
              onClick={() => {
                setIsAddingCard(true);
                if (requirements.length > 0 && newReqIds.length === 0) {
                  setNewReqIds([requirements[0]!.id]);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Flashcard</span>
            </button>
          )}

          {kitId && (
            <Link
              href={`/dashboard/kits/${kitId}/practice`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-950/40 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-900/60 hover:text-white transition-colors"
              title="Launch full-screen keyboard-friendly practice mode"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Start Practice Mode</span>
            </Link>
          )}
        </div>
      </div>

      {/* Mode 1: Study Review Mode */}
      {viewMode === 'review' && (
        <div className="max-w-2xl mx-auto space-y-6">
          {flashcards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 p-12 text-center bg-slate-900/30">
              <BookOpen className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">No flashcards to review</p>
              <p className="text-xs text-slate-500 mt-1">
                Switch to &quot;Card Editor&quot; to generate or add flashcards.
              </p>
            </div>
          ) : activeCard ? (
            <div className="space-y-4">
              {/* Review Progress Header */}
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Card {activeReviewIndex + 1} of {flashcards.length}
                </span>
                <span className="font-mono text-indigo-400">
                  {Math.round(((activeReviewIndex + 1) / flashcards.length) * 100)}% Complete
                </span>
              </div>

              {/* Interactive 3D Flip Card */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    setIsFlipped(!isFlipped);
                  }
                }}
                className={`relative min-h-[260px] cursor-pointer rounded-2xl border p-8 flex flex-col justify-between transition-all duration-300 shadow-xl ${
                  isFlipped
                    ? 'border-indigo-500/50 bg-gradient-to-br from-slate-900 to-indigo-950/40 text-slate-100'
                    : 'border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                  <span>{isFlipped ? 'ANSWER / CONCEPT' : 'PROMPT / RECALL DRILL'}</span>
                  <div className="flex items-center gap-1 text-slate-400">
                    <RotateCw className="h-3.5 w-3.5" />
                    <span>Click or Space to flip</span>
                  </div>
                </div>

                <div className="py-6 text-center">
                  <p className="text-lg font-medium text-white leading-relaxed">
                    {isFlipped ? activeCard.back : activeCard.front}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    {activeCard.requirement_ids.map((rId) => (
                      <span
                        key={rId}
                        className="rounded bg-indigo-950/80 px-2 py-0.5 font-mono text-[10px] text-indigo-300 border border-indigo-800/40"
                      >
                        {rId}
                      </span>
                    ))}
                  </div>

                  {activeCard.confidence_score && (
                    <div className="flex items-center gap-1 text-amber-400 text-xs">
                      <span>Rating:</span>
                      <span>{'★'.repeat(activeCard.confidence_score)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Confidence Rating Buttons */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
                <span className="block text-xs font-medium text-slate-400 text-center">
                  Rate Recall Confidence (Spaced Repetition):
                </span>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { score: 1, label: 'Again (1)' },
                    { score: 2, label: 'Hard (2)' },
                    { score: 3, label: 'Good (3)' },
                    { score: 4, label: 'Easy (4)' },
                    { score: 5, label: 'Mastered (5)' },
                  ].map((btn) => (
                    <button
                      key={btn.score}
                      type="button"
                      onClick={() => handleConfidenceRating(activeCard.id, btn.score)}
                      className={`rounded-lg py-2 text-xs font-medium border transition-colors ${
                        activeCard.confidence_score === btn.score
                          ? 'bg-indigo-600 text-white border-indigo-500 font-bold'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  disabled={activeReviewIndex === 0}
                  onClick={() => {
                    setActiveReviewIndex(activeReviewIndex - 1);
                    setIsFlipped(false);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Previous Card</span>
                </button>

                <button
                  type="button"
                  disabled={activeReviewIndex === flashcards.length - 1}
                  onClick={() => {
                    setActiveReviewIndex(activeReviewIndex + 1);
                    setIsFlipped(false);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white disabled:opacity-30"
                >
                  <span>Next Card</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Mode 2: Card Editor Mode */}
      {viewMode === 'editor' && (
        <div className="space-y-4">
          {/* Add Flashcard Form */}
          {isAddingCard && (
            <Card className="border-indigo-500/40 bg-indigo-950/10 p-5 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                <CardTitle className="text-sm font-semibold text-white">Create New Flashcard</CardTitle>
                <button
                  type="button"
                  onClick={() => setIsAddingCard(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Card Front (Question / Concept Prompt)
                  </label>
                  <textarea
                    value={newFront}
                    onChange={(e) => setNewFront(e.target.value)}
                    rows={4}
                    placeholder="e.g. What is the CAP theorem and how does PACELC expand upon it?"
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-100 placeholder-slate-500 focus-visible:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Card Back (Concise Answer / Key Takeaways)
                  </label>
                  <textarea
                    value={newBack}
                    onChange={(e) => setNewBack(e.target.value)}
                    rows={4}
                    placeholder="e.g. CAP states Consistency, Availability, Partition tolerance. PACELC adds: if Partition -> Availability vs Consistency; Else -> Latency vs Consistency."
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-100 placeholder-slate-500 focus-visible:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Associated Requirements
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 rounded-lg border border-slate-800 bg-slate-950">
                  {requirements.map((req) => {
                    const isSelected = newReqIds.includes(req.id);
                    return (
                      <button
                        key={req.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setNewReqIds(newReqIds.filter((id) => id !== req.id));
                          } else {
                            setNewReqIds([...newReqIds, req.id]);
                          }
                        }}
                        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-mono border transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-500'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        <span>{req.id}</span>
                        <span className="truncate max-w-[120px]">({req.text})</span>
                        {isSelected && <Check className="h-3 w-3 ml-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-indigo-500/20">
                <button
                  type="button"
                  onClick={() => setIsAddingCard(false)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddCardSubmit}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Save Flashcard
                </button>
              </div>
            </Card>
          )}

          {/* Grid of Flashcards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flashcards.map((card) => (
              <Card
                key={card.id}
                className="group border border-slate-800/80 bg-slate-950/70 p-4 hover:border-slate-700 flex flex-col justify-between transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-400 border border-slate-800">
                        {card.id}
                      </span>
                      {card.confidence_score && (
                        <span className="flex items-center gap-0.5 text-amber-400 text-xs">
                          <Star className="h-3 w-3 fill-current" />
                          <span>{card.confidence_score}/5</span>
                        </span>
                      )}
                      {card.is_edited && (
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                          Edited
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete flashcard ${card.id}?`)) {
                          deleteCard(card.id);
                        }
                      }}
                      className="text-slate-600 hover:text-rose-400 p-1 opacity-40 group-hover:opacity-100 transition-opacity"
                      title="Delete card"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Front Text */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Front (Prompt)
                    </label>
                    <textarea
                      value={card.front}
                      rows={2}
                      onChange={(e) => updateCardField(card.id, { front: e.target.value })}
                      className="w-full resize-y rounded border border-slate-800/80 bg-slate-900/60 p-2 text-xs text-slate-200 focus-visible:outline-none focus:border-indigo-500 font-medium leading-relaxed"
                    />
                  </div>

                  {/* Back Text */}
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Back (Answer Outline)
                    </label>
                    <textarea
                      value={card.back}
                      rows={2}
                      onChange={(e) => updateCardField(card.id, { back: e.target.value })}
                      className="w-full resize-y rounded border border-slate-800/80 bg-slate-950 p-2 text-xs text-slate-300 focus-visible:outline-none focus:border-indigo-500 leading-relaxed font-mono"
                    />
                  </div>
                </div>

                {/* Requirement Associations Footer */}
                <div className="pt-3 border-t border-slate-900 mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-500">Reqs:</span>
                  {card.requirement_ids.map((rId) => (
                    <span
                      key={rId}
                      className="inline-flex items-center gap-1 rounded bg-indigo-950/80 px-1.5 py-0.2 font-mono text-[10px] text-indigo-300 border border-indigo-800/40"
                    >
                      <span>{rId}</span>
                      <button
                        type="button"
                        onClick={() => toggleReqOnCard(card.id, rId)}
                        className="text-indigo-400 hover:text-rose-300 ml-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}

                  {/* Add requirement dropdown */}
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        toggleReqOnCard(card.id, e.target.value);
                      }
                    }}
                    className="rounded border border-dashed border-slate-800 bg-transparent px-1.5 py-0.2 text-[10px] text-slate-500 hover:border-slate-600 focus-visible:outline-none cursor-pointer"
                  >
                    <option value="">+ Req</option>
                    {requirements
                      .filter((r) => !card.requirement_ids.includes(r.id))
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.id}: {r.text.slice(0, 30)}
                        </option>
                      ))}
                  </select>
                </div>
              </Card>
            ))}
          </div>

          {flashcards.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center bg-slate-900/30">
              <p className="text-sm font-medium text-slate-300">No flashcards in this kit yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Click &quot;Add Flashcard&quot; to build rapid concept drill cards.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
