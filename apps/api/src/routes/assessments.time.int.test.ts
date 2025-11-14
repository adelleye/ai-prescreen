import Fastify from 'fastify';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { registerAssessments } from './assessments';

vi.mock('../db', () => {
  return {
    query: vi.fn((sql: string, _params?: unknown[]) => {
      // started_at 16 minutes ago; not finished; count 0
      const started = new Date(Date.now() - 16 * 60 * 1000).toISOString();
      if (sql.includes('with up as') || (sql.includes('select') && sql.includes('job_id'))) {
        return Promise.resolve({
          rows: [{ started_at: started, finished_at: null, n: 0, job_id: 'finance-ap' }],
        });
      }
      if (sql.includes("response->>'answerText'")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    withTransaction: vi.fn(async (callback: any) =>
      callback({
        query: vi.fn((sql: string) => {
          if (sql.includes('select started_at')) {
            const started = new Date(Date.now() - 16 * 60 * 1000).toISOString();
            return Promise.resolve({
              rows: [{ started_at: started, finished_at: null, job_id: 'finance-ap' }],
            });
          }
          if (sql.includes('select count')) {
            return Promise.resolve({ rows: [{ n: 0 }] });
          }
          if (sql.includes('update assessments')) {
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes('insert into item_events')) {
            return Promise.resolve({ rows: [{ id: 'item-1' }] });
          }
          return Promise.resolve({ rows: [] });
        }),
      }),
    ),
  };
});

describe('assessments route time expiry', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    const fakeScoring = {
      gradeAndScoreAnswer: vi.fn(async () => ({
        criteria: { policyProcedure: 2, decisionQuality: 2, evidenceSpecificity: 2 },
        total: 6,
      })),
    };
    const fakeLLMAdapter = {
      gradeAnswer: vi.fn(async () => ({
        criteria: { policyProcedure: 2, decisionQuality: 2, evidenceSpecificity: 2 },
      })),
      generateQuestion: vi.fn(async () => ({
        question: 'Test question',
        itemId: 'q_test1234',
        difficulty: 'easy',
      })),
    };
    await app.register(registerAssessments, {
      prefix: '/assessments',
      scoringService: fakeScoring,
      llmAdapter: fakeLLMAdapter,
    });
    await app.ready();
  });

  it('returns 410 when elapsed time exceeds 15 minutes', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/assessments/next-question',
      headers: {
        'X-Dev-Mode': 'true',
      },
      payload: {
        assessmentId: '00000000-0000-0000-0000-000000000000',
        difficulty: 'easy',
      },
    });
    if (res.statusCode !== 410) {
      // eslint-disable-next-line no-console
      console.log('Expected 410, got:', res.statusCode);
      // eslint-disable-next-line no-console
      console.log('Response:', res.payload);
    }
    expect(res.statusCode).toBe(410);
    const body = JSON.parse(res.payload || '{}');
    expect(body.error).toBe('TimeExpired');
  });
});
