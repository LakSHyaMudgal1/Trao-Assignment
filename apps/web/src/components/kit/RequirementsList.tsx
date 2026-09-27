import React from 'react';
import type { RequirementItem } from '@prep-kit/shared';
import { Badge } from '../ui/Badge';

interface RequirementsListProps {
  requirements: RequirementItem[];
}

export function RequirementsList({ requirements }: RequirementsListProps) {
  if (requirements.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
        No requirements extracted yet.
      </div>
    );
  }

  return (
    <ul className="space-y-2.5" aria-label="Extracted Requirements">
      {requirements.map((req) => (
        <li
          key={req.id}
          className="flex items-start justify-between gap-4 rounded-lg border border-slate-800/80 bg-slate-900/50 p-3.5 transition-colors hover:border-slate-700"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-400">
              {req.id}
            </span>
            <span className="text-sm text-slate-200">{req.text}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={req.kind}>{req.kind}</Badge>
            <Badge variant={req.priority}>{req.priority}</Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}
