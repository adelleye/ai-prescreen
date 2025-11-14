import React from 'react';

type ChatBubbleProps = {
  role: 'user' | 'assistant' | 'system';
  text: string;
};

export function ChatBubble({ role, text }: ChatBubbleProps) {
  const isUser = role === 'user';
  const isAssistant = role === 'assistant';
  
  return (
    <div className={`flex items-start gap-2 my-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar/Icon */}
      {isAssistant && (
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold">
          AI
        </div>
      )}
      {isUser && (
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs font-semibold">
          You
        </div>
      )}
      
      {/* Message bubble */}
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
          isUser
            ? 'bg-gray-900 text-white rounded-tr-sm'
            : isAssistant
            ? 'bg-blue-50 text-gray-900 border border-blue-100 rounded-tl-sm'
            : 'bg-gray-100 text-gray-600'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{text}</div>
      </div>
    </div>
  );
}
