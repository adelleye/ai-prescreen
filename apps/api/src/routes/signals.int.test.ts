import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('signals route', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://user:pass@host:5432/db';
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'very-long-secret-key-with-16-chars';
    process.env.WEB_BASE_URL = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
    process.env.LLM_API_KEY = process.env.LLM_API_KEY ?? 'sk-test';
    process.env.LLM_MODEL_PRIMARY = process.env.LLM_MODEL_PRIMARY ?? 'gpt-4o-mini';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('accepts beacon payload and returns 204', async () => {
    const { buildServer } = await import('../server');
    const app = await buildServer();
    await app.ready();
    const payload = {
      type: 'paste',
      at: new Date().toISOString(),
      itemId: 'q_aaaaaaaa',
      meta: { length: 12 },
    };
    const res = await app.inject({
      method: 'POST',
      url: '/signals',
      payload,
      headers: {
        'X-Dev-Mode': 'true',
        'Origin': 'http://localhost:3000',
      },
    });
    if (res.statusCode !== 204) {
      console.log('Expected 204, got:', res.statusCode);
      console.log('Response:', res.payload);
    }
    expect(res.statusCode).toBe(204);
  });
});



