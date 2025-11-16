'use client';

import React from 'react';

type MessageProps = {
  role: 'user' | 'assistant';
  children: React.ReactNode;
  className?: string;
};

export function Message({ role, children, className = '' }: MessageProps) {
  const isUser = role === 'user';

  return (
    <div
      className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} ${className}`}
    >
      {children}
    </div>
  );
}

type MessageAvatarProps = {
  role: 'user' | 'assistant';
  className?: string;
};

export function MessageAvatar({ role, className = '' }: MessageAvatarProps) {
  const isUser = role === 'user';

  return (
    <div
      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
        isUser ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'
      } ${className}`}
    >
      <span className="text-xs font-semibold">{isUser ? 'U' : 'AI'}</span>
    </div>
  );
}

type MessageContentProps = {
  role: 'user' | 'assistant';
  children: React.ReactNode;
  className?: string;
};

export function MessageContent({ role, children, className = '' }: MessageContentProps) {
  const isUser = role === 'user';

  return (
    <div
      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
        isUser ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-gray-50 text-gray-900'
      } ${className}`}
    >
      <div className="whitespace-pre-wrap break-words leading-relaxed">{children}</div>
    </div>
  );
}
