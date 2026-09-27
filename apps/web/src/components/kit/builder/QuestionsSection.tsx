'use client';

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Pin,
  Search,
  Sparkles,
  Check,
  X,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import type { QuestionItem, RequirementItem } from '@prep-kit/shared';

export type QuestionCategory = 'technical' | 'behavioural' | 'system-design' | 'company-fit';

interface InternalQuestionItem extends QuestionItem {
  is_pinned?: boolean;
  is_edited?: boolean;
}

interface QuestionsSectionProps {
  questions: InternalQuestionItem[];
  requirements: RequirementItem[];
  onChange: (updatedQuestions: InternalQuestionItem[]) => void;
  onRegenerateCategory?: (category: QuestionCategory) => void;
}

const CATEGORIES: { key: QuestionCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All Questions' },
  { key: 'technical', label: 'Technical' },
  { key: 'system-design', label: 'System Design' },
  { key: 'behavioural', label: 'Behavioural' },
  { key: 'company-fit', label: 'Company Fit' },
];

export function QuestionsSection({
  questions,
  requirements,
  onChange,
  onRegenerateCategory,
}: QuestionsSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<QuestionCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Add question state
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [newPrompt, setNewPrompt] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newCategory, setNewCategory] = useState<QuestionCategory>('technical');
  const [newDifficulty, setNewDifficulty] = useState<1 | 2 | 3>(2);
  const [newReqIds, setNewReqIds] = useState<string[]>([]);

  // Filtered list
  const filteredQuestions = questions.filter((q) => {
    const matchesCategory = selectedCategory === 'all' || q.category === selectedCategory;
    const matchesQuery =
      searchQuery === '' ||
      q.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.answer_outline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.requirement_ids.some((rId) => rId.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesQuery;
  });

  // Reorder helpers
  const moveQuestion = (currentIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const updated = [...questions];
    const temp = updated[currentIndex]!;
    updated[currentIndex] = updated[targetIndex]!;
    updated[targetIndex] = temp;
    onChange(updated);
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (dropIndex: number) => {
    if (draggedIndex === null || draggedIndex === dropIndex) return;
    const updated = [...questions];
    const [movedItem] = updated.splice(draggedIndex, 1);
    if (movedItem) {
      updated.splice(dropIndex, 0, movedItem);
      onChange(updated);
    }
    setDraggedIndex(null);
  };

  // Question editing
  const updateQuestionField = (id: string, updates: Partial<InternalQuestionItem>) => {
    onChange(
      questions.map((q) => (q.id === id ? { ...q, ...updates, is_edited: true } : q))
    );
  };

  const deleteQuestion = (id: string) => {
    onChange(questions.filter((q) => q.id !== id));
  };

  const toggleRequirementOnQuestion = (questionId: string, reqId: string) => {
    const q = questions.find((item) => item.id === questionId);
    if (!q) return;

    const currentReqs = q.requirement_ids;
    let nextReqs: string[];
    if (currentReqs.includes(reqId)) {
      if (currentReqs.length === 1) {
        alert('A question must reference at least one requirement.');
        return;
      }
      nextReqs = currentReqs.filter((id) => id !== reqId);
    } else {
      nextReqs = [...currentReqs, reqId];
    }

    updateQuestionField(questionId, { requirement_ids: nextReqs });
  };

  // Add Question Submission
  const handleAddQuestionSubmit = () => {
    if (!newPrompt.trim() || !newAnswer.trim()) {
      alert('Please fill out both the question prompt and the answer outline.');
      return;
    }
    if (newReqIds.length === 0) {
      alert('Please associate at least one requirement with this question.');
      return;
    }

    const newQ: InternalQuestionItem = {
      id: `q_usr_${Date.now()}`,
      prompt: newPrompt.trim(),
      answer_outline: newAnswer.trim(),
      category: newCategory,
      difficulty: newDifficulty,
      requirement_ids: newReqIds,
      is_edited: true,
      is_pinned: false,
    };

    onChange([newQ, ...questions]);
    setNewPrompt('');
    setNewAnswer('');
    setNewReqIds([]);
    setIsAddingQuestion(false);
  };

  return (
    <div className="space-y-6" id="section-questions">
      {/* Category Pills & Top Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Question Categories">
          {CATEGORIES.map((cat) => {
            const count =
              cat.key === 'all'
                ? questions.length
                : questions.filter((q) => q.category === cat.key).length;
            const isSelected = selectedCategory === cat.key;

            return (
              <button
                key={cat.key}
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedCategory(cat.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 font-semibold'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.2 text-[10px] ${
                    isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
            />
          </div>

          {selectedCategory !== 'all' && onRegenerateCategory && (
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    `Regenerate ${selectedCategory} questions? User-created, edited, and pinned questions will be preserved.`
                  )
                ) {
                  onRegenerateCategory(selectedCategory as QuestionCategory);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/40 bg-indigo-950/40 px-2.5 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-900/60 hover:text-white transition-colors shrink-0 cursor-pointer"
              title="Regenerate this category while strictly preserving edited, user-created, and pinned questions"
            >
              <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
              <span>Regenerate Category</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsAddingQuestion(true);
              if (requirements.length > 0 && newReqIds.length === 0) {
                setNewReqIds([requirements[0]!.id]);
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors shrink-0 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Question</span>
          </button>
        </div>
      </div>

      {/* Add Question Inline Card */}
      {isAddingQuestion && (
        <Card className="border-indigo-500/40 bg-indigo-950/10 p-5 space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <CardTitle className="text-sm font-semibold text-white">Create Custom Interview Question</CardTitle>
            </div>
            <button
              type="button"
              onClick={() => setIsAddingQuestion(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Target Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as QuestionCategory)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100"
              >
                <option value="technical">Technical</option>
                <option value="system-design">System Design</option>
                <option value="behavioural">Behavioural</option>
                <option value="company-fit">Company Fit</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Difficulty Level</label>
              <div className="flex gap-2">
                {[1, 2, 3].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setNewDifficulty(lvl as 1 | 2 | 3)}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium border transition-colors ${
                      newDifficulty === lvl
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Level {lvl} ({lvl === 1 ? 'Foundational' : lvl === 2 ? 'Senior' : 'Staff / Hard'})
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Question Prompt</label>
            <textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              rows={2}
              placeholder="e.g. How does distributed consensus handle network partitions in Raft vs Paxos?"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-100 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Answer Outline & Key Benchmarks</label>
            <textarea
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              rows={3}
              placeholder="Outline expected candidate depth, edge-cases, and evaluation criteria..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-100 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Associated Requirements (Select at least one)
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-lg border border-slate-800 bg-slate-950">
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
                    <span className="truncate max-w-[140px]">({req.text})</span>
                    {isSelected && <Check className="h-3 w-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-indigo-500/20">
            <button
              type="button"
              onClick={() => setIsAddingQuestion(false)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddQuestionSubmit}
              className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              Save Question
            </button>
          </div>
        </Card>
      )}

      {/* Questions List */}
      <div className="space-y-3.5">
        {filteredQuestions.map((q, filteredIdx) => {
          const globalIdx = questions.findIndex((item) => item.id === q.id);
          const difficultyLabel =
            q.difficulty === 1 ? 'Foundational' : q.difficulty === 2 ? 'Core Senior' : 'Architecture / Hard';

          return (
            <Card
              key={q.id}
              draggable
              onDragStart={() => handleDragStart(globalIdx)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(globalIdx)}
              className={`group transition-all border border-slate-800/80 bg-slate-950/70 p-4 hover:border-slate-700 ${
                draggedIndex === globalIdx ? 'opacity-40 border-indigo-500' : ''
              }`}
            >
              {/* Question Header: ID, Category Mover, Difficulty, Drag Handle, Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900 pb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-300 p-0.5"
                    title="Drag to reorder"
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>

                  <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-400 border border-slate-800">
                    {q.id}
                  </span>

                  {/* Move Question between Categories dropdown */}
                  <select
                    value={q.category}
                    onChange={(e) =>
                      updateQuestionField(q.id, {
                        category: e.target.value as QuestionCategory,
                      })
                    }
                    className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5 text-xs font-medium text-indigo-300 focus-visible:outline-none focus:border-indigo-500"
                    title="Move question to another category"
                  >
                    <option value="technical">Technical</option>
                    <option value="system-design">System Design</option>
                    <option value="behavioural">Behavioural</option>
                    <option value="company-fit">Company Fit</option>
                  </select>

                  {q.is_pinned && (
                    <span className="flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400 border border-amber-500/20 font-medium">
                      <Pin className="h-2.5 w-2.5 fill-current" />
                      Pinned
                    </span>
                  )}

                  {q.is_edited && (
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-400">
                      Edited
                    </span>
                  )}
                </div>

                {/* Right controls: Difficulty selector, Pin, Up, Down, Delete */}
                <div className="flex items-center gap-2">
                  {/* Difficulty selector */}
                  <div className="flex items-center gap-1 rounded bg-slate-900 p-0.5 border border-slate-800 text-[11px]">
                    {[1, 2, 3].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => updateQuestionField(q.id, { difficulty: lvl as 1 | 2 | 3 })}
                        title={`Difficulty: Level ${lvl} (${lvl === 1 ? 'Foundational' : lvl === 2 ? 'Core Senior' : 'Architecture / Hard'})`}
                        className={`rounded px-1.5 py-0.5 font-mono cursor-pointer transition-colors ${
                          q.difficulty === lvl
                            ? lvl === 3
                              ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40'
                              : lvl === 2
                              ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        L{lvl}
                      </button>
                    ))}
                  </div>

                  {/* Pin Toggle */}
                  <button
                    type="button"
                    onClick={() => updateQuestionField(q.id, { is_pinned: !q.is_pinned })}
                    className={`p-1 transition-colors ${
                      q.is_pinned ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'
                    }`}
                    title={q.is_pinned ? 'Unpin question' : 'Pin question (survives category regeneration)'}
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>

                  {/* Accessible Reorder buttons */}
                  <div className="flex items-center border-l border-slate-800 pl-1.5 gap-0.5">
                    <button
                      type="button"
                      disabled={globalIdx === 0}
                      onClick={() => moveQuestion(globalIdx, 'up')}
                      className="text-slate-600 hover:text-slate-300 disabled:opacity-20 p-1"
                      title="Move up"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={globalIdx === questions.length - 1}
                      onClick={() => moveQuestion(globalIdx, 'down')}
                      className="text-slate-600 hover:text-slate-300 disabled:opacity-20 p-1"
                      title="Move down"
                    >
                      <ArrowDown className="h-3 w-3" />
                    </button>
                  </div>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete question ${q.id}? It will be removed from schedule and coverage.`)) {
                        deleteQuestion(q.id);
                      }
                    }}
                    className="text-slate-600 hover:text-rose-400 p-1 transition-colors ml-1"
                    title="Delete question"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Inline Prompt Editing */}
              <div className="pt-3">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Question Prompt</label>
                <textarea
                  value={q.prompt}
                  rows={2}
                  onChange={(e) => updateQuestionField(q.id, { prompt: e.target.value })}
                  className="w-full resize-y rounded-lg border border-slate-800/80 bg-slate-900/60 p-2.5 text-sm text-slate-100 placeholder-slate-500 focus-visible:outline-none focus:border-indigo-500 font-medium leading-relaxed"
                />
              </div>

              {/* Inline Answer Outline Editing */}
              <div className="pt-2">
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Expected Answer Outline & Technical Depth
                </label>
                <textarea
                  value={q.answer_outline}
                  rows={3}
                  onChange={(e) => updateQuestionField(q.id, { answer_outline: e.target.value })}
                  className="w-full resize-y rounded-lg border border-slate-800/80 bg-slate-950 p-2.5 text-xs text-slate-300 placeholder-slate-500 focus-visible:outline-none focus:border-indigo-500 leading-relaxed font-mono"
                />
              </div>

              {/* Requirement Associations */}
              <div className="pt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium text-slate-400">Covers Requirements:</span>
                {q.requirement_ids.map((rId) => {
                  const req = requirements.find((r) => r.id === rId);
                  return (
                    <span
                      key={rId}
                      className="inline-flex items-center gap-1 rounded bg-indigo-950/80 px-2 py-0.5 font-mono text-[11px] text-indigo-300 border border-indigo-800/50"
                      title={req ? `${req.priority.toUpperCase()} - ${req.text}` : rId}
                    >
                      <span>{rId}</span>
                      {req?.priority === 'must' && (
                        <span className="text-rose-400 font-bold" title="Must-Have Requirement">
                          !
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleRequirementOnQuestion(q.id, rId)}
                        className="text-indigo-400 hover:text-rose-300 ml-0.5"
                        title="Remove requirement association"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}

                {/* Add requirement association dropdown */}
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      toggleRequirementOnQuestion(q.id, e.target.value);
                    }
                  }}
                  className="rounded border border-dashed border-slate-700 bg-transparent px-2 py-0.5 text-[11px] text-slate-400 hover:border-slate-500 focus-visible:outline-none cursor-pointer"
                >
                  <option value="">+ Associate Requirement</option>
                  {requirements
                    .filter((r) => !q.requirement_ids.includes(r.id))
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.id}: {r.priority === 'must' ? '[MUST] ' : ''}{r.text.slice(0, 45)}...
                      </option>
                    ))}
                </select>
              </div>
            </Card>
          );
        })}

        {filteredQuestions.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center bg-slate-900/30">
            <HelpCircle className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-300">No questions match the current filter</p>
            <p className="text-xs text-slate-500 mt-1">
              Try switching category tabs, clearing the search query, or click &quot;Add Question&quot; above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
