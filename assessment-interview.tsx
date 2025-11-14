'use client';

import React, { useState, useRef, useEffect } from 'react';

const AssessmentInterview: React.FC = () => {
  const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: Date }>>([
    {
      id: '1',
      role: 'assistant',
      content: 'You\'re all set. Let\'s get started with your assessment.',
      timestamp: new Date(Date.now() - 60000),
    },
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(14 * 60 + 32); // 14:32 for demo
  const [questionNumber, setQuestionNumber] = useState(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Timer countdown simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    // Add user message
    const userMessage = {
      id: Math.random().toString(),
      role: 'user' as const,
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setQuestionNumber((prev) => prev + 1);

    // Simulate AI response delay
    setTimeout(() => {
      const aiMessage = {
        id: Math.random().toString(),
        role: 'assistant' as const,
        content: `You've answered question ${questionNumber} well. Here's a follow-up: Can you elaborate on your approach?`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1500);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 relative overflow-hidden">
      {/* Atmospheric background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Soft radial gradient from top-right */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-gradient-radial from-blue-100/20 via-transparent to-transparent rounded-full blur-3xl opacity-40" />
        {/* Subtle gradient from bottom-left */}
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-gradient-radial from-indigo-50/10 via-transparent to-transparent rounded-full blur-3xl opacity-30" />
      </div>

      {/* Main container */}
      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <header className="border-b border-slate-200/60 backdrop-blur-md bg-white/70 px-6 py-4 sm:px-8">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs tracking-widest font-medium text-slate-600 uppercase">Assessment Interview</span>
            </div>

            {/* Timer */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100/80 backdrop-blur-sm border border-slate-200/50">
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-mono text-slate-700 min-w-[3rem]">{formatTime(timeRemaining)}</span>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100/80 backdrop-blur-sm border border-slate-200/50">
                <span className="text-xs text-slate-600">Question</span>
                <span className="text-sm font-semibold text-slate-800">{questionNumber}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Messages container */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-8">
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Welcome section */}
            <div className="mb-8">
              <h1 className="text-4xl sm:text-5xl font-display font-bold text-slate-900 mb-3 tracking-tight">
                Assessment Interview
              </h1>
              <p className="text-base text-slate-600 max-w-xl leading-relaxed">
                Answer each question thoughtfully. The interview adapts to your responses. You have approximately 15 minutes.
              </p>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 my-8 opacity-60">
              <div className="flex-1 h-px bg-gradient-to-r from-slate-200 via-slate-200 to-transparent" />
              <span className="text-xs tracking-widest text-slate-500 uppercase font-medium">Chat</span>
              <div className="flex-1 h-px bg-gradient-to-l from-slate-200 via-slate-200 to-transparent" />
            </div>

            {/* Messages */}
            {messages.map((message, index) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                style={{
                  animationDelay: `${index * 100}ms`,
                }}
              >
                <div
                  className={`max-w-lg px-5 py-3.5 rounded-2xl transition-all duration-300 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/20 rounded-br-sm'
                      : 'bg-slate-100/80 border border-slate-200/60 text-slate-900 backdrop-blur-sm rounded-bl-sm'
                  }`}
                >
                  <p className={`text-sm leading-relaxed ${message.role === 'user' ? 'text-blue-50' : 'text-slate-700'}`}>
                    {message.content}
                  </p>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-2 items-center mt-4">
                <div className="w-8 h-8 rounded-full bg-slate-100/80 border border-slate-200/60 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
                </div>
                <p className="text-sm text-slate-500 italic">AI is thinking...</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-slate-200/60 backdrop-blur-md bg-white/70 px-6 sm:px-8 py-6">
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="relative group">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your response here..."
                className="w-full px-5 py-3.5 rounded-2xl bg-white border border-slate-300/50 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 focus:bg-blue-50/30 transition-all duration-200 shadow-sm text-sm"
                disabled={isLoading}
              />

              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50/50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-600 disabled:hover:bg-transparent transition-colors duration-200"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5.951-1.429 5.951 1.429a1 1 0 001.169-1.409l-7-14z" />
                </svg>
              </button>
            </form>

            <p className="text-xs text-slate-500 mt-3 text-center">
              Your responses are being recorded. All questions and answers are confidential.
            </p>
          </div>
        </div>
      </div>

      {/* Global styles via style tag */}
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');

        * {
          font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .font-display {
          font-family: 'Crimson Pro', serif;
          letter-spacing: -0.02em;
        }

        .bg-gradient-radial {
          background-image: radial-gradient(var(--tw-gradient-stops));
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

        .animate-fade-in {
          animation: fade-in 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default AssessmentInterview;
