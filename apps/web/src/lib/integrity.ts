type ItemIdProvider = () => string;
import { apiUrl } from './api';

export function trackIntegritySignals(currentItemId: ItemIdProvider): () => void {
  const handlers = new Map<string, (e: Event) => void>();

  const getHumanReadableMessage = (type: string, meta?: Record<string, unknown>) => {
    switch (type) {
      case 'paste': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pasteLength = ((meta as any)?.length as number) || 0;
        return `🔴 Candidate pasted text (${pasteLength} characters)`;
      }
      case 'visibilitychange': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const state = (meta as any)?.state as string;
        return state === 'hidden'
          ? '🔴 Candidate switched to another tab'
          : '🟡 Candidate returned to assessment tab';
      }
      case 'blur':
        return '🔴 Candidate lost window focus';
      case 'focus':
        return '🟡 Candidate regained window focus';
      case 'latencyOutlier':
        return '🔴 Suspicious response delay detected';
      default:
        return `[integrity-signal] ${type}`;
    }
  };

  const record = (type: string, meta?: Record<string, unknown>) => {
    const payload = {
      type,
      at: new Date().toISOString(),
      itemId: currentItemId(),
      meta
    };
    // Log for development visibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isDev = typeof window !== 'undefined' && ((window as any).__DEV__ || process.env.NODE_ENV === 'development');
    if (isDev) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const message = getHumanReadableMessage(type, meta);
      // eslint-disable-next-line no-console
      console.log(`%c${message}`, 'color: #ff6b6b; font-weight: bold; font-size: 12px;', `on ${payload.itemId}`);
    }
    // Fire-and-forget to API later; V1 stub only (avoid blocking UI)
    try {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon?.(apiUrl('/signals'), blob);
    } catch {
      // ignore
    }
  };

  // Drop duplicate visibility states
  let lastVisibility: DocumentVisibilityState | null = null;
  const onVisibility: EventListener = () => {
    if (document.visibilityState === lastVisibility) return;
    lastVisibility = document.visibilityState;
    record('visibilitychange', { state: document.visibilityState });
  };
  const onPaste: EventListener = (e) => {
    const ce = e as ClipboardEvent;
    const length = ce.clipboardData?.getData('text')?.length ?? 0;
    record('paste', { length });
  };
  // Debounce focus/blur to reduce noise
  let fbTimer: ReturnType<typeof setTimeout> | undefined;
  let lastFb: 'focus' | 'blur' | null = null;
  const emitFb = (type: 'focus' | 'blur') => {
    if (type === lastFb) return;
    lastFb = type;
    record(type);
  };
  const debouncedFb = (type: 'focus' | 'blur') => {
    if (fbTimer) clearTimeout(fbTimer);
    fbTimer = setTimeout(() => emitFb(type), 250);
  };
  const onBlur: EventListener = () => debouncedFb('blur');
  const onFocus: EventListener = () => debouncedFb('focus');

  handlers.set('visibilitychange', onVisibility);
  handlers.set('paste', onPaste);
  handlers.set('blur', onBlur);
  handlers.set('focus', onFocus);

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('paste', onPaste);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('paste', onPaste);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
  };
}


