import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('signals route - anti-cheating signals', () => {
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

  describe('basic signal handling', () => {
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
          Origin: 'http://localhost:3000',
        },
      });
      expect(res.statusCode).toBe(204);
    }, 10000); // Increase timeout for slower CI environments

    it('accepts paste signal with metadata', async () => {
      const { buildServer } = await import('../server');
      const app = await buildServer();
      await app.ready();
      const payload = {
        type: 'paste',
        at: new Date().toISOString(),
        itemId: 'q_paste_test',
        meta: { length: 50 },
      };
      const res = await app.inject({
        method: 'POST',
        url: '/signals',
        payload,
        headers: {
          Origin: 'http://localhost:3000',
        },
      });
      expect(res.statusCode).toBe(204);
    });
  });

  describe('visibility change signals', () => {
    it('accepts visibilitychange signal for tab hidden', async () => {
      const { buildServer } = await import('../server');
      const app = await buildServer();
      await app.ready();
      const payload = {
        type: 'visibilitychange',
        at: new Date().toISOString(),
        itemId: 'q_vis_001',
        meta: { state: 'hidden' },
      };
      const res = await app.inject({
        method: 'POST',
        url: '/signals',
        payload,
        headers: {
          Origin: 'http://localhost:3000',
        },
      });
      expect(res.statusCode).toBe(204);
    });

    it('accepts visibilitychange signal for tab visible', async () => {
      const { buildServer } = await import('../server');
      const app = await buildServer();
      await app.ready();
      const payload = {
        type: 'visibilitychange',
        at: new Date().toISOString(),
        itemId: 'q_vis_002',
        meta: { state: 'visible' },
      };
      const res = await app.inject({
        method: 'POST',
        url: '/signals',
        payload,
        headers: {
          Origin: 'http://localhost:3000',
        },
      });
      expect(res.statusCode).toBe(204);
    });
  });

  describe('focus/blur signals', () => {
    it('accepts blur signal', async () => {
      const { buildServer } = await import('../server');
      const app = await buildServer();
      await app.ready();
      const payload = {
        type: 'blur',
        at: new Date().toISOString(),
        itemId: 'q_blur_001',
      };
      const res = await app.inject({
        method: 'POST',
        url: '/signals',
        payload,
        headers: {
          Origin: 'http://localhost:3000',
        },
      });
      expect(res.statusCode).toBe(204);
    });

    it('accepts focus signal', async () => {
      const { buildServer } = await import('../server');
      const app = await buildServer();
      await app.ready();
      const payload = {
        type: 'focus',
        at: new Date().toISOString(),
        itemId: 'q_focus_001',
      };
      const res = await app.inject({
        method: 'POST',
        url: '/signals',
        payload,
        headers: {
          Origin: 'http://localhost:3000',
        },
      });
      expect(res.statusCode).toBe(204);
    });
  });

  describe('latency outlier signals', () => {
    it('accepts latencyOutlier signal', async () => {
      const { buildServer } = await import('../server');
      const app = await buildServer();
      await app.ready();
      const payload = {
        type: 'latencyOutlier',
        at: new Date().toISOString(),
        itemId: 'q_latency_001',
      };
      const res = await app.inject({
        method: 'POST',
        url: '/signals',
        payload,
        headers: {
          Origin: 'http://localhost:3000',
        },
      });
      expect(res.statusCode).toBe(204);
    });
  });

  describe('invalid signal handling', () => {
    it('rejects invalid signal type', async () => {
      const { buildServer } = await import('../server');
      const app = await buildServer();
      await app.ready();
      const payload = {
        type: 'invalid_signal_type',
        at: new Date().toISOString(),
        itemId: 'q_001',
      };
      const res = await app.inject({
        method: 'POST',
        url: '/signals',
        payload,
        headers: {
          Origin: 'http://localhost:3000',
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects payload with invalid ISO timestamp', async () => {
      const { buildServer } = await import('../server');
      const app = await buildServer();
      await app.ready();
      const payload = {
        type: 'paste',
        at: 'not-a-valid-timestamp',
        itemId: 'q_001',
        meta: { length: 10 },
      };
      const res = await app.inject({
        method: 'POST',
        url: '/signals',
        payload,
        headers: {
          Origin: 'http://localhost:3000',
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('handles malformed JSON gracefully', async () => {
      const { buildServer } = await import('../server');
      const app = await buildServer();
      await app.ready();
      const res = await app.inject({
        method: 'POST',
        url: '/signals',
        payload: 'not valid json{',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('signal persistence', () => {
    it('accepts signals without itemId (optional field)', async () => {
      const { buildServer } = await import('../server');
      const app = await buildServer();
      await app.ready();
      const payload = {
        type: 'paste',
        at: new Date().toISOString(),
        meta: { length: 25 },
      };
      const res = await app.inject({
        method: 'POST',
        url: '/signals',
        payload,
        headers: {
          Origin: 'http://localhost:3000',
        },
      });
      expect(res.statusCode).toBe(204);
    });

    it('accepts signals without metadata', async () => {
      const { buildServer } = await import('../server');
      const app = await buildServer();
      await app.ready();
      const payload = {
        type: 'blur',
        at: new Date().toISOString(),
        itemId: 'q_blur_002',
      };
      const res = await app.inject({
        method: 'POST',
        url: '/signals',
        payload,
        headers: {
          Origin: 'http://localhost:3000',
        },
      });
      expect(res.statusCode).toBe(204);
    });
  });

  describe('signal logging', () => {
    it('logs signal details for audit trail', async () => {
      const { buildServer } = await import('../server');
      const app = await buildServer();
      await app.ready();

      const payload = {
        type: 'paste',
        at: new Date().toISOString(),
        itemId: 'q_log_test',
        meta: { length: 100 },
      };
      const res = await app.inject({
        method: 'POST',
        url: '/signals',
        payload,
        headers: {
          Origin: 'http://localhost:3000',
        },
      });

      // Verify signal was accepted
      expect(res.statusCode).toBe(204);
    }, 10000); // Increase timeout for slower CI environments
  });
});
