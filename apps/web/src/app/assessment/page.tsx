'use client';

import { createInitialStaircaseState, fetchWithTimeout, MAX_ASSESSMENT_ITEMS } from '@shared/core';
import { LiveRegion } from '@ui/kit';
import React, { useEffect, useRef, useState, useCallback } from 'react';

import { ErrorBoundary } from '../../components/ErrorBoundary';
import { apiUrl } from '../../lib/api';
import { trackIntegritySignals } from '../../lib/integrity';

import { ChatPanel } from './ChatPanel';
import { useAssessmentState } from './hooks/useAssessmentState';
import { useQuestionFetcher, type QuestionData } from './hooks/useQuestionFetcher';
import { useTimer } from './hooks/useTimer';

const MAX_ITEMS = MAX_ASSESSMENT_ITEMS;

function AssessmentContent() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [asked, setAsked] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const lastScoreRef = useRef<number | undefined>(undefined);
  const currentQuestionRef = useRef<QuestionData | null>(null);
  const stateRef = useRef(createInitialStaircaseState(MAX_ITEMS));
  // Track follow-ups per question to enable multi-turn conversation
  const followUpsCountRef = useRef<number>(0);
  const MAX_FOLLOW_UPS_PER_ITEM = 2;

  const { assessmentId, sessionToken, netCtrlRef } = useAssessmentState();
  const { fetchNextQuestion, loadingQuestion } = useQuestionFetcher(
    assessmentId,
    sessionToken,
    netCtrlRef,
  );
  const firstQuestionLoadedForAssessmentRef = useRef<string | null>(null);
  const fetchNextQuestionRef = useRef(fetchNextQuestion);

  // Keep a ref to the latest fetchNextQuestion so effects can depend only on assessmentId
  useEffect(() => {
    fetchNextQuestionRef.current = fetchNextQuestion;
  }, [fetchNextQuestion]);

  const handleTimeExpired = useCallback(() => {
    setRunning(false);
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', text: 'Time is up. Thanks — this session is complete.' },
    ]);
  }, []);

  const { seconds, live } = useTimer(handleTimeExpired, netCtrlRef);

  // Integrity signals
  useEffect(() => {
    const stop = trackIntegritySignals(() => asked[asked.length - 1] ?? 'init');
    return () => stop();
  }, [asked]);

  // First item - fetch from API once per assessment
  useEffect(() => {
    if (!assessmentId) return;
    // Avoid re-loading for the same assessmentId (unless retrying)
    if (firstQuestionLoadedForAssessmentRef.current === assessmentId && retryCount === 0) return;
    firstQuestionLoadedForAssessmentRef.current = assessmentId;

    let cancelled = false;

    async function loadFirstQuestion() {
      // Double-check assessmentId is available before fetching
      if (!assessmentId) {
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.log('Skipping question fetch: assessmentId not yet available');
        }
        return;
      }

      const result = await fetchNextQuestionRef.current('easy');
      if (cancelled) return;

      // Handle successful question fetch
      if (result.data) {
        currentQuestionRef.current = result.data;
        stateRef.current = createInitialStaircaseState(MAX_ITEMS);
        setAsked((prev) => [...prev, result.data!.itemId]);
        setMessages((prev) => [...prev, { role: 'assistant', text: result.data!.question }]);
        setError(null);
        return;
      }

      // Handle errors - no fallback to static questions
      if (result.errorCode === 'AssessmentFinished') {
        setRunning(false);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: 'This assessment has ended. Thank you!' },
        ]);
        return;
      }

      // NotReady is not a fatal error - just wait and retry will happen automatically
      if (result.errorCode === 'NotReady') {
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.log('Question fetch not ready, will retry:', result.errorMessage);
        }
        return;
      }

      // For other errors, show error state
      const errorMessage = result.errorMessage || 'Failed to load question from AI interviewer';
      setError({ code: result.errorCode || 'Unknown', message: errorMessage });
      setRunning(false);

      // Show user-friendly error message based on error type
      let userMessage = 'Unable to start assessment. ';
      if (result.errorCode === 'LLMConfigurationMissing') {
        userMessage +=
          process.env.NODE_ENV === 'development'
            ? 'AI service is not configured. Please check LLM_API_KEY and LLM_MODEL_PRIMARY environment variables.'
            : 'AI service is temporarily unavailable. Please try again later.';
      } else if (result.errorCode === 'NetworkError') {
        userMessage += 'Network connection issue. Please check your internet connection.';
      } else {
        userMessage +=
          process.env.NODE_ENV === 'development'
            ? `Error: ${errorMessage}`
            : 'AI interviewer could not be started. Please contact support.';
      }

      setMessages((prev) => [...prev, { role: 'assistant', text: userMessage }]);
    }

    void loadFirstQuestion();

    return () => {
      cancelled = true;
    };
  }, [assessmentId, retryCount]);

  const onSubmit = useCallback(async () => {
    if (!input.trim() || !running || loadingQuestion) return;
    const answer = input.trim();
    const currentQuestion = currentQuestionRef.current;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: answer }]);

    // Call API to score and get follow-up
    let scoreTotal: number | undefined;
    let followUp: string | undefined;
    let currentItemId: string | undefined;
    if (assessmentId) {
      try {
        currentItemId = currentQuestion?.itemId ?? asked[asked.length - 1];
        if (!netCtrlRef.current) netCtrlRef.current = new AbortController();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        // Add session token if available, otherwise use dev mode header
        if (sessionToken) {
          headers['Authorization'] = `Bearer ${sessionToken}`;
        } else {
          // Dev mode: send header to skip session validation
          headers['X-Dev-Mode'] = 'true';
        }
        const res = await fetchWithTimeout(apiUrl('/assessments/submit'), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            assessmentId,
            itemId: currentItemId ?? 'unknown',
            answerText: answer,
            questionText: currentQuestion?.question,
            clientTs: new Date().toISOString(),
            signals: [],
          }),
          timeoutMs: 12000,
          signal: netCtrlRef.current.signal,
        });
        if (res.status === 410) {
          setRunning(false);
          setMessages((prev) => [...prev, { role: 'assistant', text: 'Session ended. Thanks!' }]);
          return;
        }
        if (res.ok) {
          const data = await res.json().catch(() => null);
          followUp = data?.followUp;
          scoreTotal = Number(data?.score?.total);
          if (!Number.isFinite(scoreTotal)) scoreTotal = undefined;
        }
      } catch (err) {
        // Network hiccup — proceed using last known score
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error('Failed to submit assessment answer:', err);
        }
      }
    }

    // Handle multi-turn conversation: show follow-up and wait for answer
    if (followUp && followUpsCountRef.current < MAX_FOLLOW_UPS_PER_ITEM) {
      setMessages((prev) => [...prev, { role: 'assistant', text: followUp }]);
      followUpsCountRef.current += 1;
      return; // Wait for candidate to answer the follow-up
    }

    // Enough follow-ups or no follow-up: move to next question
    followUpsCountRef.current = 0;

    // Update score for staircase
    lastScoreRef.current = scoreTotal ?? lastScoreRef.current ?? 6;
    let difficultyHint: 'easy' | 'medium' | 'hard' | undefined;
    if (lastScoreRef.current >= 7) {
      difficultyHint = 'hard';
    } else if (lastScoreRef.current >= 4) {
      difficultyHint = 'medium';
    } else {
      difficultyHint = 'easy';
    }

    // Fetch next question from API
    const result = await fetchNextQuestion(difficultyHint);

    if (result.data) {
      currentQuestionRef.current = result.data;
      setAsked((prev) => [...prev, result.data!.itemId]);
      setMessages((prev) => [...prev, { role: 'assistant', text: result.data!.question }]);
    } else if (result.errorCode === 'AssessmentFinished') {
      // Assessment ended
      setRunning(false);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Thanks — this session is complete.' },
      ]);
    } else {
      // Error occurred - stop the assessment
      const numAsked = asked.length;
      if (numAsked >= MAX_ITEMS) {
        setRunning(false);
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: 'Thanks — this session is complete.' },
        ]);
      } else {
        setRunning(false);
        const errorMsg =
          process.env.NODE_ENV === 'development'
            ? `Error generating next question: ${result.errorMessage || 'Unknown error'}`
            : 'Unable to continue assessment. The session has been ended.';
        setMessages((prev) => [...prev, { role: 'assistant', text: errorMsg }]);
      }
    }
  }, [
    input,
    running,
    loadingQuestion,
    fetchNextQuestion,
    assessmentId,
    sessionToken,
    netCtrlRef,
    asked,
  ]);

  const handleRetry = useCallback(() => {
    setError(null);
    setRetryCount((prev) => prev + 1);
    setRunning(true);
    firstQuestionLoadedForAssessmentRef.current = null; // Allow reload
  }, []);

  return (
    <>
      {error && retryCount < 1 && (
        <div
          style={{
            padding: '16px',
            margin: '16px',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '8px',
          }}
        >
          <p style={{ margin: '0 0 12px 0', fontWeight: 'bold' }}>Assessment Error</p>
          <p style={{ margin: '0 0 12px 0' }}>{error.message}</p>
          <button
            onClick={handleRetry}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}
      <ChatPanel
        messages={messages}
        input={input}
        onInputChange={setInput}
        onSubmit={onSubmit}
        disabled={!running}
        loading={loadingQuestion}
        secondsRemaining={seconds}
      />
      <LiveRegion text={live} />
    </>
  );
}

export default function AssessmentPage() {
  return (
    <ErrorBoundary
      level="assessment"
      onError={(error, errorInfo) => {
        // Log error for monitoring (in production, send to error tracking service)
        if (process.env.NODE_ENV === 'production') {
          // Example: logErrorToService(error, errorInfo);
          console.error('Assessment error:', error, errorInfo);
        }
      }}
    >
      <AssessmentContent />
    </ErrorBoundary>
  );
}
