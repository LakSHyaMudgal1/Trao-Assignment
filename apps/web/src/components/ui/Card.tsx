import React, { type HTMLAttributes } from 'react';

export function Card({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900/80 p-5 shadow-sm backdrop-blur-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mb-4 border-b border-slate-800/80 pb-3 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = '',
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`text-lg font-semibold tracking-tight text-slate-100 ${className}`} {...props}>
      {children}
    </h3>
  );
}
