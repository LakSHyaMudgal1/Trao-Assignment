import React from 'react';
import type { QuestionItem } from '@prep-kit/shared';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';

interface QuestionItemCardProps {
  question: QuestionItem;
}

export function QuestionItemCard({ question }: QuestionItemCardProps) {
  const difficultyStars = '★'.repeat(question.difficulty) + '☆'.repeat(3 - question.difficulty);

  return (
    <Card className="transition-all hover:border-slate-700">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs font-semibold text-slate-300">
              {question.id}
            </span>
            <Badge variant={question.category}>{question.category}</Badge>
          </div>

          <div className="flex items-center gap-3">
            <span
              className="text-xs text-amber-400"
              title={`Difficulty: ${question.difficulty} of 3`}
              aria-label={`Difficulty ${question.difficulty} of 3`}
            >
              {difficultyStars}
            </span>
            <div className="flex items-center gap-1">
              {question.requirement_ids.map((rId) => (
                <span
                  key={rId}
                  className="rounded bg-indigo-950/60 px-1.5 py-0.5 font-mono text-[10px] text-indigo-300 border border-indigo-800/40"
                >
                  {rId}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-slate-100">{question.prompt}</h4>
          <div className="mt-2 rounded-md bg-slate-950/60 p-2.5 text-xs leading-relaxed text-slate-400 border border-slate-800/50">
            <span className="font-semibold text-slate-300">Answer Outline: </span>
            {question.answer_outline}
          </div>
        </div>
      </div>
    </Card>
  );
}
