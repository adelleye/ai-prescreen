import { useState, useEffect } from 'react';
import type { RefObject } from 'react';

const MAX_SECONDS = 15 * 60;

/**
 * Manages assessment timer via Web Worker for reliable countdown.
 * Returns timer state and provides callback when time expires.
 */
export function useTimer(onTimeExpired: () => void, netCtrlRef: RefObject<AbortController | null>) {
  const [seconds, setSeconds] = useState(MAX_SECONDS);
  const [live, setLive] = useState('');

  useEffect(() => {
    netCtrlRef.current = new AbortController();
    let cleanup: (() => void) | null = null;
    try {
      const worker = new Worker(new URL('../../../workers/timer.ts', import.meta.url), {
        type: 'module',
      });
      worker.postMessage({ type: 'start', seconds: MAX_SECONDS });
      worker.onmessage = (e) => {
        if (e.data.type === 'tick') {
          setSeconds(e.data.seconds);
          setLive(`Time remaining ${e.data.seconds} seconds`);
        } else if (e.data.type === 'end') {
          try {
            netCtrlRef.current?.abort();
          } catch (err) {
            if (process.env.NODE_ENV === 'development') {
              console.error('Error aborting network controller:', err);
            }
          }
          setLive('Time ended');
          onTimeExpired();
        }
      };
      cleanup = () => worker.terminate();
    } catch (err) {
      // Fallback to setInterval if Worker instantiation fails (e.g., invalid URL in dev)
      if (process.env.NODE_ENV === 'development') {
        console.error('Timer worker failed, falling back to setInterval:', err);
      }
      const startedAt = Date.now();
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        const remaining = Math.max(0, MAX_SECONDS - elapsed);
        setSeconds(remaining);
        setLive(`Time remaining ${remaining} seconds`);
        if (remaining === 0) {
          clearInterval(interval);
          try {
            netCtrlRef.current?.abort();
          } catch (abortErr) {
            if (process.env.NODE_ENV === 'development') {
              console.error('Error aborting network controller:', abortErr);
            }
          }
          setLive('Time ended');
          onTimeExpired();
        }
      }, 1000);
      cleanup = () => clearInterval(interval);
    }
    return () => {
      if (cleanup) cleanup();
    };
  }, [onTimeExpired, netCtrlRef]);

  return { seconds, live };
}
