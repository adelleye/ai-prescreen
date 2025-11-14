'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';

type ConversationProps = React.HTMLAttributes<HTMLDivElement>;

export function Conversation({ className = '', children, ...props }: ConversationProps) {
  return (
    <div className={`relative flex flex-col ${className}`} {...props}>
      {children}
    </div>
  );
}

type ConversationContentProps = React.HTMLAttributes<HTMLDivElement>;

export function ConversationContent({ className = '', children, ...props }: ConversationContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  const scrollToBottom = useCallback(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (!contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
    setShowScrollButton(!isAtBottom);
    setAutoScroll(isAtBottom);
  }, []);

  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [children, autoScroll, scrollToBottom]);

  return (
    <>
      <div
        ref={contentRef}
        className={`flex-1 overflow-y-auto px-4 py-4 ${className}`}
        onScroll={handleScroll}
        {...props}
      >
        <div className="mx-auto max-w-3xl space-y-4">
          {children}
        </div>
      </div>
      {showScrollButton && (
        <ConversationScrollButton onClick={scrollToBottom} />
      )}
    </>
  );
}

type ConversationScrollButtonProps = {
  onClick: () => void;
};

export function ConversationScrollButton({ onClick }: ConversationScrollButtonProps) {
  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
      aria-label="Scroll to bottom"
    >
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
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  );
}


