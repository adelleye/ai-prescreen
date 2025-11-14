type ItemIdProvider = () => string;
import { apiUrl } from './api';

export function trackIntegritySignals(currentItemId: ItemIdProvider): () => void {
  const handlers = new Map<string, (e: Event) => void>();

  const record = (type: string, meta?: Record<string, unknown>) => {
    const payload = {
      type,
      at: new Date().toISOString(),
      itemId: currentItemId(),
      meta
    };
    // Fire-and-forget to API later; V1 stub only (avoid blocking UI)
    try {
      navigator.sendBeacon?.(apiUrl('/signals'), JSON.stringify(payload));
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


