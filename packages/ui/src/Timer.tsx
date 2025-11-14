import React from 'react';

type TimerProps = {
  secondsRemaining: number;
};

export function Timer({ secondsRemaining }: TimerProps) {
  const m = Math.floor(secondsRemaining / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(secondsRemaining % 60)
    .toString()
    .padStart(2, '0');
  return <div aria-live="polite" className="font-mono text-sm text-gray-700">{`${m}:${s}`}</div>;
}





