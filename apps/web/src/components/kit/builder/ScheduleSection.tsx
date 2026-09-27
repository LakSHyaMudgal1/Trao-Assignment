'use client';

import React from 'react';
import { Calendar, Clock, Sparkles, CheckCircle2, AlertTriangle, Plus, Trash2, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../../ui/Card';
import type { ScheduleDay, QuestionItem } from '@prep-kit/shared';

interface ScheduleData {
  days_available: number;
  days: ScheduleDay[];
}

interface ScheduleSectionProps {
  schedule: ScheduleData;
  questions: QuestionItem[];
  onChange: (updatedSchedule: ScheduleData) => void;
  onRegenerate?: () => void;
}

export function ScheduleSection({
  schedule,
  questions,
  onChange,
  onRegenerate,
}: ScheduleSectionProps) {
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  // Calculate high-level summary metrics
  const totalMinutes = schedule.days.reduce((sum, d) => sum + (d.minutes || 0), 0);
  const avgMinutes = schedule.days.length > 0 ? Math.round(totalMinutes / schedule.days.length) : 0;
  const totalHours = (totalMinutes / 60).toFixed(1);

  // Check anti-cramming rule: does the final day contain difficulty 3 questions?
  const finalDay = schedule.days[schedule.days.length - 1];
  const finalDayHasDiff3 =
    schedule.days_available > 1 &&
    finalDay?.question_ids.some((qId) => questionMap.get(qId)?.difficulty === 3);

  const handleFocusChange = (dayIndex: number, focus: string) => {
    const updatedDays = [...schedule.days];
    updatedDays[dayIndex] = { ...updatedDays[dayIndex]!, focus };
    onChange({ ...schedule, days: updatedDays });
  };

  const handleMinutesChange = (dayIndex: number, deltaOrVal: number, isAbsolute = false) => {
    const updatedDays = [...schedule.days];
    const current = updatedDays[dayIndex]!.minutes;
    const nextVal = isAbsolute ? deltaOrVal : Math.max(15, current + deltaOrVal);
    // Ensure integer
    updatedDays[dayIndex] = { ...updatedDays[dayIndex]!, minutes: Math.round(nextVal) };
    onChange({ ...schedule, days: updatedDays });
  };

  const handleRemoveQuestionFromDay = (dayIndex: number, questionId: string) => {
    const updatedDays = [...schedule.days];
    const day = updatedDays[dayIndex]!;
    updatedDays[dayIndex] = {
      ...day,
      question_ids: day.question_ids.filter((id) => id !== questionId),
    };
    onChange({ ...schedule, days: updatedDays });
  };

  const handleAddQuestionToDay = (dayIndex: number, questionId: string) => {
    if (!questionId) return;
    const updatedDays = [...schedule.days];
    const day = updatedDays[dayIndex]!;
    if (day.question_ids.includes(questionId)) return;
    updatedDays[dayIndex] = {
      ...day,
      question_ids: [...day.question_ids, questionId],
    };
    onChange({ ...schedule, days: updatedDays });
  };

  return (
    <div className="space-y-6" id="section-schedule">
      {/* Regeneration & Schedule Actions Toolbar */}
      {onRegenerate && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-2.5 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-indigo-400" />
            <span className="text-xs text-slate-300">
              Deterministic allocation across <span className="font-semibold text-white">{schedule.days_available} days</span>. Reallocating schedule leaves all questions and other sections untouched.
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (confirm('Regenerate deterministic study schedule? Questions, brief, and other sections will not be touched.')) {
                onRegenerate();
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-950/40 px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-900/60 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Re-run deterministic schedule allocation without modifying any questions"
          >
            <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
            <span>Regenerate Schedule</span>
          </button>
        </div>
      )}

      {/* Schedule Analytics & Anti-Cramming Metrics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Preparation Horizon</p>
              <p className="text-lg font-bold text-white">
                {schedule.days_available} {schedule.days_available === 1 ? 'Day' : 'Days'}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Total Workload</p>
              <p className="text-lg font-bold text-white">
                {totalMinutes} min <span className="text-xs text-slate-500 font-normal">({totalHours}h)</span>
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Average Daily Target</p>
              <p className="text-lg font-bold text-white">{avgMinutes} min/day</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-slate-900/60 border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                finalDayHasDiff3
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}
            >
              {finalDayHasDiff3 ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Anti-Cramming Rule</p>
              <p className="text-xs font-semibold text-white">
                {finalDayHasDiff3 ? 'Warning: Diff 3 on Day K' : 'Protected: Calm Final Day'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Days Roadmap */}
      <div className="space-y-4">
        {schedule.days.map((day, dayIdx) => {
          const isFinal = day.day === schedule.days_available && schedule.days_available > 1;

          return (
            <Card
              key={day.day}
              className={`border transition-all ${
                isFinal
                  ? 'border-indigo-500/30 bg-gradient-to-r from-slate-950 via-slate-950 to-indigo-950/20'
                  : 'border-slate-800/80 bg-slate-950/70 hover:border-slate-700'
              }`}
            >
              <div className="p-4 space-y-3">
                {/* Day Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                        isFinal
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                          : 'bg-slate-800 text-slate-200'
                      }`}
                    >
                      D{day.day}
                    </span>
                    <span className="text-xs font-semibold text-white">
                      Day {day.day} {isFinal ? '(Final Polish & Mindset)' : ''}
                    </span>
                  </div>

                  {/* Integer Minutes Editor */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">Duration:</span>
                    <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900 p-0.5">
                      <button
                        type="button"
                        onClick={() => handleMinutesChange(dayIdx, -15)}
                        className="rounded px-2 py-0.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800"
                        title="-15 minutes"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={15}
                        step={5}
                        value={day.minutes}
                        onChange={(e) =>
                          handleMinutesChange(dayIdx, parseInt(e.target.value, 10) || 45, true)
                        }
                        className="w-14 bg-transparent text-center font-mono text-xs font-semibold text-white focus-visible:outline-none"
                      />
                      <span className="text-[10px] text-slate-500 pr-1.5">min</span>
                      <button
                        type="button"
                        onClick={() => handleMinutesChange(dayIdx, 15)}
                        className="rounded px-2 py-0.5 text-xs text-slate-400 hover:text-white hover:bg-slate-800"
                        title="+15 minutes"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Day Focus Input */}
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Pedagogical Focus & Milestone Objective
                  </label>
                  <input
                    type="text"
                    value={day.focus}
                    onChange={(e) => handleFocusChange(dayIdx, e.target.value)}
                    placeholder="e.g. Core Distributed Systems Architecture & Raft Review"
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus-visible:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                {/* Scheduled Questions */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-medium text-slate-400">
                      Allocated Questions ({day.question_ids.length})
                    </span>

                    {/* Add question to day */}
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddQuestionToDay(dayIdx, e.target.value);
                        }
                      }}
                      className="rounded border border-dashed border-slate-800 bg-slate-950 px-2 py-0.5 text-[11px] text-slate-400 hover:border-slate-600 focus-visible:outline-none cursor-pointer"
                    >
                      <option value="">+ Assign Question to Day {day.day}</option>
                      {questions
                        .filter((q) => !day.question_ids.includes(q.id))
                        .map((q) => (
                          <option key={q.id} value={q.id}>
                            {q.id} ({q.category}, Diff {q.difficulty}): {q.prompt.slice(0, 45)}...
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {day.question_ids.map((qId) => {
                      const q = questionMap.get(qId);
                      return (
                        <div
                          key={qId}
                          className="flex items-center justify-between gap-3 rounded-lg border border-slate-900 bg-slate-900/40 px-3 py-2 text-xs text-slate-300 hover:border-slate-800 transition-colors"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="rounded bg-slate-800 px-1.5 py-0.2 font-mono text-[10px] text-slate-400 shrink-0">
                              {qId}
                            </span>
                            {q && (
                              <>
                                <span
                                  className={`rounded px-1.5 py-0.2 text-[10px] font-mono shrink-0 ${
                                    q.difficulty === 3
                                      ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                                      : q.difficulty === 2
                                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                      : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                  }`}
                                >
                                  Diff {q.difficulty}
                                </span>
                                <span className="truncate text-slate-200">{q.prompt}</span>
                              </>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveQuestionFromDay(dayIdx, qId)}
                            className="text-slate-500 hover:text-rose-400 p-0.5 shrink-0"
                            title="Unassign question from this day"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}

                    {day.question_ids.length === 0 && (
                      <p className="text-xs text-slate-500 italic py-1">
                        No specific questions assigned yet. Self-directed study day.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
