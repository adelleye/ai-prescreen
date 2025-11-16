'use client';

import React from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="max-w-md w-full rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-red-800 mb-2">Something went wrong</h2>
        <p className="text-sm text-red-700 mb-4">An unexpected error occurred. Please try again.</p>
        {process.env.NODE_ENV === 'development' && error && (
          <details className="mt-2 mb-4">
            <summary className="text-xs text-red-600 cursor-pointer">
              Error details (dev only)
            </summary>
            <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
        <button
          onClick={reset}
          className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
