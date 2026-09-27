import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className = '', ...props }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-800/70 ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <div className="space-y-2 pt-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>
    </div>
  );
}

export function KitRowSkeleton() {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-start sm:items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-center">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

export function QuestionSkeleton() {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-5 w-3/4" />
      <div className="space-y-1.5 pt-1">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
      <div className="flex items-center gap-2 pt-2">
        <Skeleton className="h-4 w-24 rounded" />
        <Skeleton className="h-4 w-28 rounded" />
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header bar skeleton */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2 border-b border-slate-800/80 pb-2">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>

      {/* Content grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      <div className="space-y-3 pt-4">
        <QuestionSkeleton />
        <QuestionSkeleton />
      </div>
    </div>
  );
}
