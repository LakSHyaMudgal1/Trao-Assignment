import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?:
    | 'must'
    | 'nice'
    | 'technical'
    | 'behavioural'
    | 'domain'
    | 'system-design'
    | 'company-fit'
    | 'success'
    | 'warning'
    | 'info'
    | 'pinned'
    | 'default';
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const variants = {
    must: 'bg-rose-500/10 text-rose-300 border border-rose-500/30 font-semibold',
    nice: 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30',
    technical: 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30',
    behavioural: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
    domain: 'bg-teal-500/10 text-teal-300 border border-teal-500/30',
    'system-design': 'bg-amber-500/10 text-amber-300 border border-amber-500/30',
    'company-fit': 'bg-purple-500/10 text-purple-300 border border-purple-500/30',
    success: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
    info: 'bg-sky-500/15 text-sky-300 border border-sky-500/30',
    pinned: 'bg-amber-500/15 text-amber-200 border border-amber-400/40 font-medium',
    default: 'bg-slate-800/80 text-slate-300 border border-slate-700/80',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
