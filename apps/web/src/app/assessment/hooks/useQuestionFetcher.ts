import { useState, useCallback } from 'react';
import type { RefObject } from 'react';
import { fetchWithTimeout } from '@shared/core';
import { apiUrl } from '../../../lib/api';

export type QuestionData = {
  question: string;
  itemId: string;
  difficulty: 'easy' | 'medium' | 'hard';
};

export type QuestionFetchResult = {
  data: QuestionData | null;
  errorCode?: string;
  errorMessage?: string;
};

/**
 * Manages question fetching from the API with loading state and error handling.
 */
export function useQuestionFetcher(
  assessmentId: string | null,
  sessionToken: string | null,
  netCtrlRef: RefObject<AbortController | null>,
) {
  const [loadingQuestion, setLoadingQuestion] = useState(false);

  const fetchNextQuestion = useCallback(
    async (difficultyHint?: 'easy' | 'medium' | 'hard'): Promise<QuestionFetchResult> => {
      if (!assessmentId) {
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.warn('Cannot fetch question: assessmentId is null');
        }
        return { data: null, errorCode: 'NotReady', errorMessage: 'Assessment ID not available' };
      }
      if (loadingQuestion) {
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.warn('Cannot fetch question: already loading');
        }
        return { data: null, errorCode: 'NotReady', errorMessage: 'Question fetch already in progress' };
      }
      setLoadingQuestion(true);
      try {
        if (!netCtrlRef.current) netCtrlRef.current = new AbortController();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        // Add session token if available, otherwise use dev mode header
        if (sessionToken) {
          headers['Authorization'] = `Bearer ${sessionToken}`;
        } else {
          // Dev mode: send header to skip session validation
          headers['X-Dev-Mode'] = 'true';
        }
        const res = await fetchWithTimeout(apiUrl('/assessments/next-question'), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            assessmentId,
            difficulty: difficultyHint,
          }),
          timeoutMs: 15000,
          signal: netCtrlRef.current.signal,
        });
        
        if (res.status === 410) {
          return { data: null, errorCode: 'AssessmentFinished' };
        }
        
        if (!res.ok) {
          // Try to parse error response
          let errorCode = 'QuestionGenerationFailed';
          let errorMessage = 'Failed to generate question';
          try {
            const errorData = await res.json();
            // Backend uses 'error' field for error code
            if (errorData?.error) errorCode = errorData.error;
            if (errorData?.message) errorMessage = errorData.message;
          } catch {
            // Fallback to generic error
          }
          
          if (process.env.NODE_ENV === 'development') {
            // eslint-disable-next-line no-console
            console.error('Next question request failed:', {
              status: res.status,
              errorCode,
              errorMessage,
            });
          }
          
          return { data: null, errorCode, errorMessage };
        }
        
        const data = await res.json().catch(() => null);
        
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.log('Question fetch response:', { status: res.status, data });
        }
        
        if (data?.ok && data.question) {
          return {
            data: {
              question: data.question,
              itemId: data.itemId,
              difficulty: data.difficulty,
            },
          };
        }
        
        // Log invalid response details for debugging
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error('Invalid response format:', { data, hasOk: data?.ok, hasQuestion: !!data?.question });
        }
        
        return { data: null, errorCode: 'InvalidResponse', errorMessage: 'Invalid response from server' };
      } catch (err) {
        // Network error
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error('Failed to fetch question:', err);
        }
        return { 
          data: null, 
          errorCode: 'NetworkError', 
          errorMessage: err instanceof Error ? err.message : 'Network request failed'
        };
      } finally {
        setLoadingQuestion(false);
      }
    },
    [assessmentId, sessionToken, netCtrlRef],
  );

  return { fetchNextQuestion, loadingQuestion };
}
