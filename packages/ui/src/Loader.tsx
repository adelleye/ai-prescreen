'use client';

import React from 'react';

type LoaderProps = {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

export function Loader({ className = '', size = 'md' }: LoaderProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div className="flex items-center gap-1">
        <div className={`${sizeClasses[size]} animate-pulse rounded-full bg-gray-300`} />
        <div className={`${sizeClasses[size]} animate-pulse rounded-full bg-gray-300 animation-delay-200`} />
        <div className={`${sizeClasses[size]} animate-pulse rounded-full bg-gray-300 animation-delay-400`} />
      </div>
    </div>
  );
}

type TypingIndicatorProps = {
  className?: string;
};

export function TypingIndicator({ className = '' }: TypingIndicatorProps) {
  return (
    <div
      className={`flex items-start gap-3 ${className}`}
      role="status"
      aria-live="polite"
      aria-label="AI is typing"
    >
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-900">
        <span className="text-xs font-semibold">AI</span>
      </div>
      <div className="mt-2 flex items-center gap-1 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}


