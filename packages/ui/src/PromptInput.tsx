'use client';

import React, { useRef, useEffect, type FormEvent } from 'react';

type PromptInputProps = {
  onSubmit: (value: string) => void;
  children: React.ReactNode;
  className?: string;
};

export function PromptInput({ onSubmit, children, className = '' }: PromptInputProps) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const value = formData.get('prompt') as string;
    if (value?.trim()) {
      onSubmit(value.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`border-t border-gray-200 bg-white ${className}`}>
      {children}
    </form>
  );
}

type PromptInputTextareaProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  className?: string;
};

export function PromptInputTextarea({
  value,
  onChange,
  placeholder = 'Type a message...',
  disabled = false,
  onKeyDown,
  className = '',
}: PromptInputTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      name="prompt"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      rows={1}
      className={`w-full resize-none border-none bg-transparent px-4 py-3 text-sm placeholder:text-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}

type PromptInputToolbarProps = {
  children: React.ReactNode;
  className?: string;
};

export function PromptInputToolbar({ children, className = '' }: PromptInputToolbarProps) {
  return (
    <div className={`flex items-center justify-between gap-2 px-4 pb-3 ${className}`}>
      {children}
    </div>
  );
}

type PromptInputSubmitProps = {
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
};

export function PromptInputSubmit({
  disabled = false,
  children,
  className = '',
}: PromptInputSubmitProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-label="Submit"
      className={`inline-flex items-center justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children || (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m5 12 7-7 7 7" />
          <path d="M12 19V5" />
        </svg>
      )}
    </button>
  );
}

type PromptInputHintProps = {
  children: React.ReactNode;
  className?: string;
};

export function PromptInputHint({ children, className = '' }: PromptInputHintProps) {
  return <span className={`text-xs text-gray-400 ${className}`}>{children}</span>;
}
