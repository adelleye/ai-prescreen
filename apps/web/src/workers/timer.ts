/// <reference lib="webworker" />

type TimerMessage = 
  | { type: 'start'; seconds: number }
  | { type: 'stop' };

type WorkerResponse = 
  | { type: 'tick'; seconds: number }
  | { type: 'end' };

const workerSelf = self as unknown as DedicatedWorkerGlobalScope;

let interval: ReturnType<typeof setInterval> | undefined;
let endAtMs = 0;
let lastEmittedSeconds = -1;

workerSelf.onmessage = (e: MessageEvent<TimerMessage>) => {
  const data = e.data;
  if (data.type === 'start' && typeof data.seconds === 'number') {
    startTimer(data.seconds);
  } else if (data.type === 'stop') {
    if (interval) clearInterval(interval);
  }
};

function startTimer(totalSeconds: number) {
  if (interval) clearInterval(interval);
  endAtMs = Date.now() + totalSeconds * 1000;
  lastEmittedSeconds = Math.max(0, Math.ceil((endAtMs - Date.now()) / 1000));
  // Emit initial tick immediately to sync UI
  workerSelf.postMessage({ type: 'tick', seconds: lastEmittedSeconds } satisfies WorkerResponse);
  // Tick frequently but only emit when whole-second changes to reduce drift
  interval = setInterval(onTick, 250);
}

function onTick() {
  const remainingMs = endAtMs - Date.now();
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  if (seconds === lastEmittedSeconds) return;
  lastEmittedSeconds = seconds;
  if (seconds > 0) {
    workerSelf.postMessage({ type: 'tick', seconds } satisfies WorkerResponse);
  } else {
    workerSelf.postMessage({ type: 'end' } satisfies WorkerResponse);
    if (interval) clearInterval(interval);
  }
}


