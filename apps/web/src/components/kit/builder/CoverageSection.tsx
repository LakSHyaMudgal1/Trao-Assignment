'use client';

import React from 'react';
import { ShieldCheck, AlertCircle, CheckCircle2, Plus, Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import type { RequirementItem, QuestionItem } from '@prep-kit/shared';

interface CoverageData {
  uncovered_requirement_ids: string[];
  passes: number;
}

interface CoverageSectionProps {
  coverage: CoverageData;
  requirements: RequirementItem[];
  questions: QuestionItem[];
  onAddQuestionForReq?: (reqId: string) => void;
}

export function CoverageSection({
  coverage,
  requirements,
  questions,
  onAddQuestionForReq,
}: CoverageSectionProps) {
  // Deterministically compute coverage in real-time based on actual question state
  const referencedReqIds = new Set<string>();
  const reqToQuestionsMap = new Map<string, QuestionItem[]>();

  for (const q of questions) {
    for (const rId of q.requirement_ids) {
      referencedReqIds.add(rId);
      const existing = reqToQuestionsMap.get(rId) || [];
      existing.push(q);
      reqToQuestionsMap.set(rId, existing);
    }
  }

  const coveredReqs = requirements.filter((r) => referencedReqIds.has(r.id));
  const uncoveredReqs = requirements.filter((r) => !referencedReqIds.has(r.id));

  const totalCount = requirements.length;
  const coveredCount = coveredReqs.length;
  const coveragePercent = totalCount > 0 ? Math.round((coveredCount / totalCount) * 100) : 100;

  const mustReqs = requirements.filter((r) => r.priority === 'must');
  const coveredMustCount = mustReqs.filter((r) => referencedReqIds.has(r.id)).length;
  const allMustCovered = coveredMustCount === mustReqs.length;

  const niceReqs = requirements.filter((r) => r.priority === 'nice');
  const coveredNiceCount = niceReqs.filter((r) => referencedReqIds.has(r.id)).length;

  return (
    <div className="space-y-6" id="section-coverage">
      {/* Coverage Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Overall Percentage */}
        <Card className="p-5 bg-slate-900/60 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Requirement Coverage
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 font-mono text-xs font-bold border ${
                coveragePercent === 100
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              {coveragePercent}%
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{coveredCount}</span>
            <span className="text-sm text-slate-400 font-mono">/ {totalCount} Requirements</span>
          </div>

          {/* Progress Bar */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-950">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                coveragePercent === 100
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-amber-500 to-indigo-500'
              }`}
              style={{ width: `${coveragePercent}%` }}
            />
          </div>
        </Card>

        {/* Must-Have Status */}
        <Card className="p-5 bg-slate-900/60 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Must-Have Requirements
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 font-mono text-xs font-bold border ${
                allMustCovered
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              {allMustCovered ? '100% Satisfied' : 'Action Required'}
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{coveredMustCount}</span>
            <span className="text-sm text-slate-400 font-mono">/ {mustReqs.length} Must-Haves</span>
          </div>

          <p className="mt-2 text-xs text-slate-500">
            {allMustCovered
              ? 'All non-negotiable requirements are backed by validated questions.'
              : `${mustReqs.length - coveredMustCount} must-have requirement(s) missing interview coverage!`}
          </p>
        </Card>

        {/* Nice-to-Have Status */}
        <Card className="p-5 bg-slate-900/60 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Nice-to-Have Skills
            </span>
            <span className="rounded-full bg-indigo-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-indigo-400 border border-indigo-500/30">
              Audit Passes: {coverage.passes}
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white">{coveredNiceCount}</span>
            <span className="text-sm text-slate-400 font-mono">/ {niceReqs.length} Nice-to-Haves</span>
          </div>

          <p className="mt-2 text-xs text-slate-500">
            Secondary competencies and supplementary domain expertise.
          </p>
        </Card>
      </div>

      {/* Uncovered Requirements Alert & Action List */}
      {uncoveredReqs.length > 0 && (
        <Card className="border-rose-500/30 bg-rose-950/10 p-5">
          <CardHeader className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-rose-400" />
              <div>
                <CardTitle className="text-sm font-semibold text-rose-300">
                  Uncovered Requirements ({uncoveredReqs.length})
                </CardTitle>
                <p className="text-xs text-rose-400/80 mt-0.5">
                  The candidate may be asked about these skills without prior preparation
                </p>
              </div>
            </div>
          </CardHeader>

          <div className="space-y-2 pt-1">
            {uncoveredReqs.map((req) => (
              <div
                key={req.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-rose-500/20 bg-slate-950/80 p-3"
              >
                <div className="flex items-start sm:items-center gap-2.5">
                  <span className="rounded bg-rose-500/20 px-2 py-0.5 font-mono text-xs font-bold text-rose-300 border border-rose-500/30 shrink-0">
                    {req.id}
                  </span>
                  <Badge variant={req.priority}>{req.priority}</Badge>
                  <span className="text-xs text-slate-200">{req.text}</span>
                </div>

                {onAddQuestionForReq && (
                  <button
                    type="button"
                    onClick={() => onAddQuestionForReq(req.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition-colors shrink-0 self-end sm:self-center"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Create Question</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Covered Requirements Matrix */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Covered Requirements Matrix ({coveredReqs.length})
            </CardTitle>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Requirements linked to specific interview questions in this kit
          </p>
        </CardHeader>

        <div className="space-y-2.5 pt-1">
          {coveredReqs.map((req) => {
            const coveringQuestions = reqToQuestionsMap.get(req.id) || [];
            return (
              <div
                key={req.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-slate-800/80 bg-slate-950/60 p-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-2.5 flex-1">
                  <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs font-semibold text-slate-300 shrink-0">
                    {req.id}
                  </span>
                  <Badge variant={req.priority}>{req.priority}</Badge>
                  <Badge variant={req.kind}>{req.kind}</Badge>
                  <span className="text-xs text-slate-200 leading-relaxed">{req.text}</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-slate-500">Evaluated in:</span>
                  {coveringQuestions.map((q) => (
                    <span
                      key={q.id}
                      className="rounded bg-indigo-950/80 px-2 py-0.5 font-mono text-[11px] text-indigo-300 border border-indigo-800/40"
                      title={q.prompt}
                    >
                      {q.id} (L{q.difficulty})
                    </span>
                  ))}
                </div>
              </div>
            );
          })}

          {coveredReqs.length === 0 && (
            <p className="text-xs text-slate-500 italic py-4 text-center">
              No requirements are currently covered. Add question associations to satisfy requirements.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
