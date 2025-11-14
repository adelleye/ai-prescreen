import React, { useState, useEffect, useRef } from 'react';
import { fetchWithTimeout, isValidUUID } from '@shared/core';
import { apiUrl } from '../../../lib/api';

/**
 * Manages assessment state including assessmentId and sessionToken acquisition and persistence.
 * Handles magic link consumption, dev mode, and session storage caching.
 */
export function useAssessmentState() {
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const netCtrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const u = new URL(window.location.href);
    const token = u.searchParams.get('token');
    const devAssessmentId = u.searchParams.get('devAssessmentId');
    const cachedAssessmentId = sessionStorage.getItem('assessmentId');
    const cachedSessionToken = sessionStorage.getItem('sessionToken');
    
    // Validate cached assessmentId is a valid UUID, clear if invalid
    if (cachedAssessmentId && !isValidUUID(cachedAssessmentId)) {
      sessionStorage.removeItem('assessmentId');
      sessionStorage.removeItem('sessionToken');
    }
    
    // Dev mode: use assessmentId directly (no session required for dev)
    // Prioritize URL parameter over cached value to ensure we use the correct UUID
    if (devAssessmentId) {
      // Validate devAssessmentId is a valid UUID
      if (isValidUUID(devAssessmentId)) {
        // Always use the UUID from URL, even if different from cached
        sessionStorage.setItem('assessmentId', devAssessmentId);
        setAssessmentId(devAssessmentId);
        // Dev mode doesn't use sessions, so we don't set sessionToken
        return;
      } else {
        // Invalid UUID in URL, clear it
        sessionStorage.removeItem('assessmentId');
      }
    }
    
    async function consume() {
      try {
        if (!netCtrlRef.current) netCtrlRef.current = new AbortController();
        const res = await fetchWithTimeout(apiUrl('/magic/consume'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          timeoutMs: 8000,
          signal: netCtrlRef.current.signal,
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.ok && data.assessmentId && data.sessionToken) {
            // Validate assessmentId from API is a valid UUID
            if (isValidUUID(String(data.assessmentId))) {
              sessionStorage.setItem('assessmentId', String(data.assessmentId));
              sessionStorage.setItem('sessionToken', data.sessionToken);
              setAssessmentId(String(data.assessmentId));
              setSessionToken(data.sessionToken);
              return;
            }
          }
        }
      } catch {
        // ignore
      }
      // Fallback to cached values if consume fails (only if valid UUID)
      if (cachedAssessmentId && isValidUUID(cachedAssessmentId)) {
        setAssessmentId(cachedAssessmentId);
      }
      if (cachedSessionToken) {
        setSessionToken(cachedSessionToken);
      }
    }
    
    async function createDevAssessment() {
      // In dev mode, auto-create a valid assessment if none exists
      try {
        if (!netCtrlRef.current) netCtrlRef.current = new AbortController();
        const res = await fetchWithTimeout(apiUrl('/dev/test-assessment'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId: 'finance-ap' }),
          timeoutMs: 8000,
          signal: netCtrlRef.current.signal,
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.ok && data.assessmentId && isValidUUID(data.assessmentId)) {
            // Update URL with valid assessmentId
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('devAssessmentId', data.assessmentId);
            window.history.replaceState({}, '', newUrl.toString());
            sessionStorage.setItem('assessmentId', data.assessmentId);
            setAssessmentId(data.assessmentId);
            return;
          }
        }
      } catch {
        // ignore
      }
    }
    
    if (token) {
      consume();
    } else {
      // Use cached values if no token (only if valid UUID)
      if (cachedAssessmentId && isValidUUID(cachedAssessmentId)) {
        setAssessmentId(cachedAssessmentId);
      }
      if (cachedSessionToken) {
        setSessionToken(cachedSessionToken);
      } else if (process.env.NODE_ENV === 'development' && !cachedAssessmentId) {
        // In dev mode with no cached assessmentId, auto-create one
        createDevAssessment();
      }
    }
  }, []);

  return { assessmentId, sessionToken, netCtrlRef };
}

