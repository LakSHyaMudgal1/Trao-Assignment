import React, { type ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090d16] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 cursor-pointer select-none';

  const variants = {
    primary:
      'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-950/50 border border-indigo-500/40 hover:border-indigo-400',
    secondary:
      'bg-slate-800/90 hover:bg-slate-700/90 text-slate-100 border border-slate-700/80 hover:border-slate-600 shadow-sm',
    outline:
      'border border-slate-700/80 bg-slate-900/40 hover:bg-slate-800/80 hover:border-slate-600 text-slate-200 shadow-sm',
    ghost:
      'text-slate-300 hover:bg-slate-800/60 hover:text-white border border-transparent',
    danger:
      'bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-950/50 border border-rose-500/40',
  };

  const sizes = {
    sm: 'text-xs px-2.5 py-1.5 gap-1.5 font-medium',
    md: 'text-sm px-3.5 py-2 gap-2 font-medium',
    lg: 'text-base px-5 py-2.5 gap-2.5 font-semibold',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
