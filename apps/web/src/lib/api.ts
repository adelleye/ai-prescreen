export function getApiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  return base.replace(/\/+$/, '');
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}



