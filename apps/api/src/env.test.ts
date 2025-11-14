import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('env.validateEnv', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('passes in production when required vars exist', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgres://user:pass@host:5432/db';
    process.env.JWT_SECRET = 'very-long-secret-key-with-16-chars';
    process.env.WEB_BASE_URL = 'http://localhost:3000';
    process.env.LLM_API_KEY = 'sk-test';
    process.env.LLM_MODEL_PRIMARY = 'gpt-4o-mini';
    const { validateEnv } = await import('./env');
    expect(() => validateEnv()).not.toThrow();
  });

  it('throws in production when a required var is missing', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    process.env.JWT_SECRET = 'very-long-secret-key-with-16-chars';
    process.env.WEB_BASE_URL = 'http://localhost:3000';
    process.env.LLM_API_KEY = 'sk-test';
    process.env.LLM_MODEL_PRIMARY = 'gpt-4o-mini';
    const { validateEnv } = await import('./env');
    expect(() => validateEnv()).toThrow(/DATABASE_URL/);
  });
});



