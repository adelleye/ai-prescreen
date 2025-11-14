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
    const worker = new Worker(new URL('../../../workers/timer.ts', import.meta.url), {
      type: 'module',
    });
    worker.postMessage({ type: 'start', seconds: MAX_SECONDS });
    worker.onmessage = (e) => {
      if (e.data.type === 'tick') {
        setSeconds(e.data.seconds);
        setLive(`Time remaining ${e.data.seconds} seconds`);
      } else if (e.data.type === 'end') {
        // Abort any in-flight requests when timer ends
        try {
          netCtrlRef.current?.abort();
        } catch (err) {
          // Log abort errors in development for debugging
          if (process.env.NODE_ENV === 'development') {
            console.error('Error aborting network controller:', err);
          }
        }
        setLive('Time ended');
        onTimeExpired();
      }
    };
    return () => {
      worker.terminate();
    };
  }, [onTimeExpired, netCtrlRef]);

  return { seconds, live };
}
