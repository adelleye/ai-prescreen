'use client';

import React, { useEffect, useRef, useState } from 'react';

type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

type ChatPanelProps = {
  messages: ChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  loading?: boolean;
  secondsRemaining: number;
  className?: string;
};

/**
 * Premium, white-theme assessment interview interface.
 * High-end aesthetic with editorial typography, subtle animations, and minimal visual noise.
 * Reduces candidate anxiety with clean, professional design inspired by Duolingo English Test + Vercel.
 */
export function ChatPanel({
  messages,
  input,
  onInputChange,
  onSubmit,
  disabled,
  loading = false,
  secondsRemaining,
  className = '',
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [inputHeight, setInputHeight] = useState(48);

  // Auto scroll to bottom smoothly
  useEffect(() => {
    const scrollTimer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 0);
    return () => clearTimeout(scrollTimer);
  }, [messages, loading]);

  // Dynamic textarea height adjustment
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      const newHeight = Math.min(inputRef.current.scrollHeight, 150);
      setInputHeight(newHeight);
      inputRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && input.trim()) {
        onSubmit();
      }
    }
  };

  const formatTime = (seconds: number): { minutes: number; seconds: number; isLow: boolean } => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const isLow = seconds < 60;
    return { minutes: mins, seconds: secs, isLow };
  };

  const timeDisplay = formatTime(secondsRemaining);
  const timeString = `${timeDisplay.minutes}:${timeDisplay.seconds.toString().padStart(2, '0')}`;

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        flexDirection: 'column',
        background: 'linear-gradient(to bottom right, #f8fafc, #ffffff, #f1f5f9)',
        fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
      className={className}
    >
      {/* Atmospheric background decorations */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {/* Top-right blue glow */}
        <div
          style={{
            position: 'absolute',
            top: '-128px',
            right: '-128px',
            width: '384px',
            height: '384px',
            background: 'radial-gradient(circle, rgba(191, 219, 254, 0.2), transparent)',
            borderRadius: '50%',
            filter: 'blur(96px)',
            opacity: 0.4,
          }}
        />
        {/* Bottom-left indigo glow */}
        <div
          style={{
            position: 'absolute',
            bottom: '-128px',
            left: '-128px',
            width: '384px',
            height: '384px',
            background: 'radial-gradient(circle, rgba(224, 231, 255, 0.1), transparent)',
            borderRadius: '50%',
            filter: 'blur(96px)',
            opacity: 0.3,
          }}
        />
      </div>

      {/* Header: Clean, minimal, professional */}
      <header
        style={{
          position: 'relative',
          zIndex: 10,
          borderBottom: '1px solid rgba(100, 116, 139, 0.6)',
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 1px 3px rgba(100, 116, 139, 0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Status indicator */}
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            />
            <span
              style={{
                fontSize: '12px',
                letterSpacing: '0.05em',
                fontWeight: 500,
                color: '#475569',
                textTransform: 'uppercase',
              }}
            >
              Assessment Interview
            </span>
          </div>

          {/* Timer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '8px',
              background: timeDisplay.isLow
                ? 'rgba(254, 242, 242, 0.8)'
                : 'rgba(226, 232, 240, 0.8)',
              border: timeDisplay.isLow
                ? '1px solid rgba(248, 113, 113, 0.5)'
                : '1px solid rgba(148, 163, 184, 0.5)',
              backdropFilter: 'blur(4px)',
              transition: 'all 0.3s ease',
            }}
            role="status"
            aria-live="polite"
            aria-label={`Time remaining: ${timeString}`}
          >
            <svg
              style={{
                width: '16px',
                height: '16px',
                flexShrink: 0,
                color: timeDisplay.isLow ? '#dc2626' : '#64748b',
              }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 2m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span
              style={{
                fontSize: '14px',
                fontFamily: 'monospace',
                color: timeDisplay.isLow ? '#b91c1c' : '#475569',
                fontWeight: timeDisplay.isLow ? 600 : 400,
              }}
            >
              {timeString}
            </span>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <main
        style={{
          position: 'relative',
          zIndex: 10,
          flex: 1,
          overflowY: 'auto',
          scrollBehavior: 'smooth',
          padding: '32px 24px',
        }}
        role="log"
        aria-label="Conversation history"
        aria-live="polite"
      >
        <div style={{ margin: '0 auto', width: '100%', maxWidth: '672px' }}>
          {/* Welcome section */}
          {messages.length === 0 && !loading && (
            <div style={{ marginBottom: '32px' }}>
              <h1
                style={{
                  fontSize: '48px',
                  fontFamily: "'Crimson Pro', serif",
                  fontWeight: 700,
                  color: '#0f172a',
                  marginBottom: '12px',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                Assessment Interview
              </h1>
              <p
                style={{
                  fontSize: '16px',
                  color: '#64748b',
                  maxWidth: '448px',
                  lineHeight: 1.6,
                }}
              >
                Answer each question thoughtfully. The interview adapts to your responses. You have
                approximately 15 minutes.
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  margin: '32px 0',
                  opacity: 0.6,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: '1px',
                    background: 'linear-gradient(to right, #cbd5e1, #cbd5e1, transparent)',
                  }}
                />
                <span
                  style={{
                    fontSize: '12px',
                    letterSpacing: '0.05em',
                    color: '#64748b',
                    textTransform: 'uppercase',
                    fontWeight: 500,
                  }}
                >
                  Chat
                </span>
                <div
                  style={{
                    flex: 1,
                    height: '1px',
                    background: 'linear-gradient(to left, #cbd5e1, #cbd5e1, transparent)',
                  }}
                />
              </div>
            </div>
          )}

          {/* Message bubbles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {messages.map((message, index) => (
              <MessageBubble
                key={index}
                message={message}
                index={index}
                _isLastMessage={index === messages.length - 1 && !loading}
              />
            ))}

            {/* Loading indicator */}
            {loading && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  animation: 'fade-in 0.4s ease-out',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(226, 232, 240, 0.8)',
                    border: '1px solid rgba(148, 163, 184, 0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#94a3b8',
                      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    }}
                  />
                </div>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#64748b',
                    fontStyle: 'italic',
                    marginTop: '6px',
                  }}
                >
                  AI is thinking...
                </p>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} style={{ height: 0, width: '100%' }} />
          </div>
        </div>
      </main>

      {/* Input Area */}
      <footer
        style={{
          position: 'relative',
          zIndex: 10,
          borderTop: '1px solid rgba(100, 116, 139, 0.6)',
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(12px)',
          padding: '24px',
        }}
      >
        <div style={{ margin: '0 auto', width: '100%', maxWidth: '672px' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
          >
            {/* Input field */}
            <div style={{ position: 'relative' }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                placeholder={disabled ? 'Session ended' : 'Type your response here...'}
                rows={1}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  paddingRight: '48px',
                  borderRadius: '16px',
                  backgroundColor: disabled ? '#f1f5f9' : '#ffffff',
                  border: '1px solid rgba(148, 163, 184, 0.5)',
                  fontSize: '14px',
                  color: disabled ? '#cbd5e1' : '#0f172a',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  resize: 'none',
                  maxHeight: '150px',
                  minHeight: '48px',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.2s ease',
                  outline: 'none',
                  cursor: disabled ? 'not-allowed' : 'text',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = '1px solid #3b82f6';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.02)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = '1px solid rgba(148, 163, 184, 0.5)';
                  e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)';
                  e.currentTarget.style.backgroundColor = '#ffffff';
                }}
                aria-label="Your response"
              />

              {/* Send button */}
              <button
                type="submit"
                disabled={disabled || !input.trim()}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: '8px',
                  borderRadius: '12px',
                  background: 'transparent',
                  border: 'none',
                  color: disabled ? '#cbd5e1' : '#475569',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  opacity: disabled ? 0.4 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={(e) => {
                  if (!disabled) {
                    e.currentTarget.style.color = '#2563eb';
                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!disabled) {
                    e.currentTarget.style.color = '#475569';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
                aria-label="Send message"
              >
                <svg
                  style={{ width: '20px', height: '20px' }}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5.951-1.429 5.951 1.429a1 1 0 001.169-1.409l-7-14z" />
                </svg>
              </button>
            </div>

            {/* Help text */}
            <p
              style={{
                fontSize: '12px',
                color: '#64748b',
                textAlign: 'center',
              }}
            >
              Your responses are being recorded. All questions and answers are confidential.
            </p>
          </form>
        </div>
      </footer>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        html, body {
          margin: 0;
          padding: 0;
        }
      `,
        }}
      />
    </div>
  );
}

/**
 * Individual message bubble component with role-based styling
 */
interface MessageBubbleProps {
  message: ChatMessage;
  index: number;
  _isLastMessage: boolean;
}

function MessageBubble({ message, index, _isLastMessage }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '12px',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        animation: 'fade-in 0.4s ease-out forwards',
        animationDelay: `${index * 100}ms`,
      }}
    >
      {/* Message bubble */}
      <div
        style={{
          maxWidth: '448px',
          padding: '14px 20px',
          borderRadius: '16px',
          background: isUser
            ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
            : 'rgba(226, 232, 240, 0.8)',
          color: isUser ? '#f0f9ff' : '#1e293b',
          border: isUser ? 'none' : '1px solid rgba(148, 163, 184, 0.6)',
          backdropFilter: isUser ? 'none' : 'blur(4px)',
          boxShadow: isUser ? '0 10px 15px -3px rgba(37, 99, 235, 0.2)' : 'none',
          borderBottomLeftRadius: isUser ? '16px' : '4px',
          borderBottomRightRadius: isUser ? '4px' : '16px',
          transition: 'all 0.3s ease',
        }}
      >
        <p
          style={{
            fontSize: '14px',
            lineHeight: 1.6,
            margin: 0,
            color: isUser ? '#f0f9ff' : '#1e293b',
            fontFamily: "'IBM Plex Sans', sans-serif",
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {message.text}
        </p>
      </div>
    </div>
  );
}
