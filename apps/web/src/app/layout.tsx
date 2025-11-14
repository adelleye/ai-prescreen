import React from 'react';

import { ErrorBoundary } from '../components/ErrorBoundary';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#000000" />
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; worker-src 'self' blob:;"
        />
        <title>Juno Quick Screen</title>
      </head>
      <body className="min-h-screen bg-neutral-50 text-gray-900">
        <ErrorBoundary level="app">
          <main className="mx-auto max-w-3xl p-4">{children}</main>
        </ErrorBoundary>
      </body>
    </html>
  );
}
