'use client';

import React, { useState } from 'react';

export default function HomePage() {
  const [emailInput, setEmailInput] = useState('');
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        flexDirection: 'column',
        background: 'linear-gradient(to bottom right, #f8fafc, #ffffff, #f1f5f9)',
        fontFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* Atmospheric background decorations */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        {/* Top-right blue glow */}
        <div
          style={{
            position: 'absolute',
            top: '-200px',
            right: '-200px',
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15), transparent)',
            borderRadius: '50%',
            filter: 'blur(120px)',
            opacity: 0.5,
          }}
        />
        {/* Bottom-left indigo glow */}
        <div
          style={{
            position: 'absolute',
            bottom: '-200px',
            left: '-200px',
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(147, 112, 219, 0.1), transparent)',
            borderRadius: '50%',
            filter: 'blur(120px)',
            opacity: 0.4,
          }}
        />
        {/* Center accent */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '600px',
            background: 'radial-gradient(circle, rgba(239, 68, 68, 0.05), transparent)',
            borderRadius: '50%',
            filter: 'blur(150px)',
            opacity: 0.3,
          }}
        />
      </div>

      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '640px',
            width: '100%',
            textAlign: 'center',
            animation: 'fade-in 0.6s ease-out',
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              borderRadius: '20px',
              background: 'rgba(37, 99, 235, 0.1)',
              border: '1px solid rgba(37, 99, 235, 0.2)',
              marginBottom: '24px',
              animation: 'fade-in 0.6s ease-out 0.1s both',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#1e40af',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              AI-Powered Assessment
            </span>
          </div>

          {/* Main Headline */}
          <h1
            style={{
              fontSize: '64px',
              fontFamily: "'Crimson Pro', serif",
              fontWeight: 700,
              color: '#0f172a',
              marginBottom: '20px',
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              animation: 'fade-in 0.6s ease-out 0.2s both',
            }}
          >
            Juno Quick Screen
          </h1>

          {/* Subheadline */}
          <p
            style={{
              fontSize: '20px',
              color: '#64748b',
              marginBottom: '32px',
              lineHeight: 1.6,
              maxWidth: '520px',
              margin: '0 auto 32px',
              fontWeight: 400,
              animation: 'fade-in 0.6s ease-out 0.3s both',
            }}
          >
            Adaptive AI pre-screening that identifies top talent in about 15 minutes. Fast, fair, and transparent.
          </p>

          {/* Feature bullets */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '48px',
              animation: 'fade-in 0.6s ease-out 0.4s both',
            }}
          >
            {[
              'Adaptive questioning that adjusts to candidate level',
              'Real-time integrity signals (no proctors needed)',
              'Instant scoring and candidate ranking',
            ].map((feature, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  justifyContent: 'center',
                  fontSize: '14px',
                  color: '#475569',
                }}
              >
                <svg
                  style={{
                    width: '20px',
                    height: '20px',
                    color: '#10b981',
                    flexShrink: 0,
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {feature}
              </div>
            ))}
          </div>

          {/* CTA Button */}
          <div
            style={{
              animation: 'fade-in 0.6s ease-out 0.5s both',
            }}
          >
            <a
              href="/assessment"
              style={{ textDecoration: 'none' }}
            >
              <button
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                style={{
                  padding: '14px 40px',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#ffffff',
                  background: isHovering
                    ? 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)'
                    : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  boxShadow: isHovering
                    ? '0 20px 25px -5px rgba(37, 99, 235, 0.3)'
                    : '0 10px 15px -3px rgba(37, 99, 235, 0.2)',
                  transition: 'all 0.3s ease',
                  transform: isHovering ? 'translateY(-2px)' : 'translateY(0)',
                  fontFamily: "'IBM Plex Sans', sans-serif",
                  letterSpacing: '0.02em',
                }}
              >
                Start Assessment
              </button>
            </a>
          </div>

          {/* Footer text */}
          <p
            style={{
              fontSize: '13px',
              color: '#94a3b8',
              marginTop: '32px',
              animation: 'fade-in 0.6s ease-out 0.6s both',
            }}
          >
            No setup required. Assessment takes about 15 minutes. Results are instant.
          </p>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        html, body {
          margin: 0;
          padding: 0;
          background: linear-gradient(to bottom right, #f8fafc, #ffffff, #f1f5f9);
        }

        * {
          box-sizing: border-box;
        }
      `,
        }}
      />
    </div>
  );
}

