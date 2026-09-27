'use client';

import React, { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Briefcase, Star, Layers } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import type { RequirementItem } from '@prep-kit/shared';

export interface RoleData {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: RequirementItem[];
}

interface RoleSectionProps {
  role: RoleData;
  coveredRequirementIds?: Set<string>;
  onChange: (updatedRole: RoleData) => void;
}

export function RoleSection({ role, coveredRequirementIds = new Set(), onChange }: RoleSectionProps) {
  const [newRespText, setNewRespText] = useState('');
  const [isAddingResp, setIsAddingResp] = useState(false);

  const [newReqText, setNewReqText] = useState('');
  const [newReqKind, setNewReqKind] = useState<'technical' | 'behavioural' | 'domain'>('technical');
  const [newReqPriority, setNewReqPriority] = useState<'must' | 'nice'>('must');
  const [isAddingReq, setIsAddingReq] = useState(false);

  // Title & Seniority changes
  const handleTitleChange = (val: string) => {
    onChange({ ...role, title: val });
  };

  const handleSeniorityChange = (val: string) => {
    onChange({ ...role, seniority: val });
  };

  // Responsibilities
  const handleRespChange = (index: number, val: string) => {
    const updated = [...role.responsibilities];
    updated[index] = val;
    onChange({ ...role, responsibilities: updated });
  };

  const handleAddResp = () => {
    if (!newRespText.trim()) return;
    onChange({
      ...role,
      responsibilities: [...role.responsibilities, newRespText.trim()],
    });
    setNewRespText('');
    setIsAddingResp(false);
  };

  const handleDeleteResp = (index: number) => {
    onChange({
      ...role,
      responsibilities: role.responsibilities.filter((_, idx) => idx !== index),
    });
  };

  const handleMoveResp = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= role.responsibilities.length) return;
    const updated = [...role.responsibilities];
    const temp = updated[index]!;
    updated[index] = updated[newIdx]!;
    updated[newIdx] = temp;
    onChange({ ...role, responsibilities: updated });
  };

  // Requirements
  const handleReqTextChange = (id: string, text: string) => {
    onChange({
      ...role,
      requirements: role.requirements.map((r) => (r.id === id ? { ...r, text } : r)),
    });
  };

  const handleReqPriorityToggle = (id: string) => {
    onChange({
      ...role,
      requirements: role.requirements.map((r) =>
        r.id === id ? { ...r, priority: r.priority === 'must' ? 'nice' : 'must' } : r
      ),
    });
  };

  const handleReqKindChange = (id: string, kind: 'technical' | 'behavioural' | 'domain') => {
    onChange({
      ...role,
      requirements: role.requirements.map((r) => (r.id === id ? { ...r, kind } : r)),
    });
  };

  const handleDeleteReq = (id: string) => {
    onChange({
      ...role,
      requirements: role.requirements.filter((r) => r.id !== id),
    });
  };

  const handleAddReq = () => {
    if (!newReqText.trim()) return;
    // Generate next stable requirement ID like r1, r2, ...
    const existingNums = role.requirements
      .map((r) => {
        const match = r.id.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
    const newId = `r${nextNum}`;

    const newRequirement: RequirementItem = {
      id: newId,
      text: newReqText.trim(),
      kind: newReqKind,
      priority: newReqPriority,
    };

    onChange({
      ...role,
      requirements: [...role.requirements, newRequirement],
    });

    setNewReqText('');
    setIsAddingReq(false);
  };

  return (
    <div className="space-y-6" id="section-role">
      {/* Role Title and Seniority Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-indigo-400" />
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Role Definition & Seniority
            </CardTitle>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">Role Title</label>
            <input
              type="text"
              value={role.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="e.g. Senior Distributed Systems Engineer"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm font-medium text-slate-100 placeholder-slate-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Target Seniority Level</label>
            <input
              type="text"
              value={role.seniority}
              onChange={(e) => handleSeniorityChange(e.target.value)}
              placeholder="e.g. Senior / Staff (IC5-IC6)"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-sm font-medium text-slate-100 placeholder-slate-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
            />
          </div>
        </div>
      </Card>

      {/* Two Column Layout: Responsibilities & Requirements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Responsibilities */}
        <Card className="flex flex-col">
          <CardHeader className="flex items-center justify-between pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-400" />
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                  Key Responsibilities ({role.responsibilities.length})
                </CardTitle>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Core engineering scope extracted from the job description
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddingResp(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <Plus className="h-3 w-3" />
              <span>Add</span>
            </button>
          </CardHeader>

          {isAddingResp && (
            <div className="mb-3 rounded-lg border border-indigo-500/30 bg-indigo-950/20 p-2.5 space-y-2">
              <input
                type="text"
                value={newRespText}
                onChange={(e) => setNewRespText(e.target.value)}
                placeholder="e.g. Architect and maintain high-throughput Kafka streaming pipelines"
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddResp();
                  if (e.key === 'Escape') setIsAddingResp(false);
                }}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingResp(false)}
                  className="rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddResp}
                  className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Save Responsibility
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2 flex-1 pt-1">
            {role.responsibilities.map((resp, idx) => (
              <div
                key={idx}
                className="group flex items-start gap-2 rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5 hover:border-slate-700 transition-colors"
              >
                <div className="mt-1 flex flex-col items-center gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => handleMoveResp(idx, 'up')}
                    disabled={idx === 0}
                    className="text-slate-400 hover:text-white disabled:opacity-20"
                    title="Move Up"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveResp(idx, 'down')}
                    disabled={idx === role.responsibilities.length - 1}
                    className="text-slate-400 hover:text-white disabled:opacity-20"
                    title="Move Down"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>

                <textarea
                  value={resp}
                  rows={2}
                  onChange={(e) => handleRespChange(idx, e.target.value)}
                  className="flex-1 resize-none rounded border border-transparent bg-transparent p-1 text-xs text-slate-200 focus:border-slate-700 focus:bg-slate-900 focus-visible:outline-none leading-relaxed"
                />

                <button
                  type="button"
                  onClick={() => handleDeleteResp(idx)}
                  className="text-slate-500 hover:text-rose-400 p-1 opacity-40 group-hover:opacity-100 transition-opacity"
                  title="Delete responsibility"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {role.responsibilities.length === 0 && (
              <p className="text-xs text-slate-500 italic py-4 text-center">
                No responsibilities listed. Click &quot;Add&quot; to define role duties.
              </p>
            )}
          </div>
        </Card>

        {/* Requirements */}
        <Card className="flex flex-col">
          <CardHeader className="flex items-center justify-between pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-400" />
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                  Extracted Requirements ({role.requirements.length})
                </CardTitle>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluated in coverage checking and question generation
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddingReq(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors"
            >
              <Plus className="h-3 w-3" />
              <span>Add</span>
            </button>
          </CardHeader>

          {isAddingReq && (
            <div className="mb-3 rounded-lg border border-indigo-500/30 bg-indigo-950/20 p-2.5 space-y-2">
              <input
                type="text"
                value={newReqText}
                onChange={(e) => setNewReqText(e.target.value)}
                placeholder="e.g. 5+ years of experience with distributed consensus (Raft, Paxos)"
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddReq();
                  if (e.key === 'Escape') setIsAddingReq(false);
                }}
                autoFocus
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <select
                    value={newReqKind}
                    onChange={(e) => setNewReqKind(e.target.value as any)}
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300"
                  >
                    <option value="technical">Technical</option>
                    <option value="behavioural">Behavioural</option>
                    <option value="domain">Domain</option>
                  </select>
                  <select
                    value={newReqPriority}
                    onChange={(e) => setNewReqPriority(e.target.value as any)}
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300"
                  >
                    <option value="must">Must-Have</option>
                    <option value="nice">Nice-to-Have</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingReq(false)}
                    className="rounded border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddReq}
                    className="rounded bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-500"
                  >
                    Save Requirement
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 flex-1 pt-1 max-h-[460px] overflow-y-auto pr-1">
            {role.requirements.map((req) => {
              const isCovered = coveredRequirementIds.has(req.id);
              return (
                <div
                  key={req.id}
                  className="group flex flex-col gap-2 rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-slate-900 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-300">
                        {req.id}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleReqPriorityToggle(req.id)}
                        title="Click to toggle Must / Nice"
                        className="cursor-pointer"
                      >
                        <Badge variant={req.priority}>{req.priority}</Badge>
                      </button>
                      <select
                        value={req.kind}
                        onChange={(e) => handleReqKindChange(req.id, e.target.value as any)}
                        className="rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 text-[10px] text-slate-300 font-mono"
                      >
                        <option value="technical">technical</option>
                        <option value="behavioural">behavioural</option>
                        <option value="domain">domain</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-medium border ${
                          isCovered
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {isCovered ? 'Covered' : 'Uncovered'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteReq(req.id)}
                        className="text-slate-500 hover:text-rose-400 p-0.5 opacity-40 group-hover:opacity-100 transition-opacity"
                        title="Delete requirement"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={req.text}
                    rows={2}
                    onChange={(e) => handleReqTextChange(req.id, e.target.value)}
                    className="w-full resize-none rounded border border-transparent bg-transparent p-1 text-xs text-slate-200 focus:border-slate-700 focus:bg-slate-900 focus-visible:outline-none leading-relaxed"
                  />
                </div>
              );
            })}

            {role.requirements.length === 0 && (
              <p className="text-xs text-slate-500 italic py-4 text-center">
                No requirements extracted. Click &quot;Add&quot; to add skill benchmarks.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
