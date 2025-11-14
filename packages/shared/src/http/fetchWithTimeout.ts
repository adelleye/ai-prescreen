export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15000);
  const forwardAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeout);
      // Create a rejected promise similar to fetch abort behavior
      throw new DOMException('Aborted', 'AbortError');
    }
    options.signal.addEventListener('abort', forwardAbort);
  }
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    if (options.signal) {
      options.signal.removeEventListener('abort', forwardAbort);
    }
    clearTimeout(timeout);
  }
}


