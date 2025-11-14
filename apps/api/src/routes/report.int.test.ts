import Fastify from 'fastify';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db', () => {
  return {
    query: vi.fn((sql: string) => {
      if (sql.includes('avg(')) {
        return Promise.resolve({ rows: [{ avg_total: '4.5' }] });
      }
      if (sql.includes('select events')) {
        return Promise.resolve({ rows: [{ events: [] }] });
      }
      if (sql.includes('insert into audit_logs')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    }),
  };
});

describe('report csv', () => {
  let app: ReturnType<typeof Fastify>;
  beforeEach(async () => {
    // Set NODE_ENV to development to allow dev mode bypass
    process.env.NODE_ENV = 'development';
    process.env.VERCEL = undefined;
    process.env.DATABASE_URL = 'postgres://user:pass@host:5432/db';

    // Force reload of modules to pick up new NODE_ENV
    vi.resetModules();

    app = Fastify();
    const { registerReport: reportModule } = await import('./report');
    await app.register(reportModule, { prefix: '/report' });
    await app.ready();
  });

  it('returns CSV with totalScore and integrityBand', async () => {
    const assessmentId = '00000000-0000-0000-0000-000000000000';
    const res = await app.inject({
      method: 'GET',
      url: '/report/csv',
      query: { assessmentId },
      headers: {
        'X-Dev-Mode': 'true',
      },
    });
    if (res.statusCode !== 200) {
      // eslint-disable-next-line no-console
      console.log('Expected 200, got:', res.statusCode);
      // eslint-disable-next-line no-console
      console.log('Response:', res.payload);
    }
    expect(res.statusCode).toBe(200);
    const body = res.body.trim();
    expect(body).toContain('assessmentId,totalScore,integrityBand');
    expect(body).toContain(`${assessmentId},50`); // 4.5/9*100 → 50
  });
});
