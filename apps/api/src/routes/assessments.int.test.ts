import { MAX_ASSESSMENT_ITEMS } from '@shared/core';
import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerAssessments } from './assessments';

vi.mock('../db', () => {
  // Provide a mutable sequence of results for successive calls
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let calls = 0;
  return {
    query: vi.fn((sql: string) => {
      calls++;
      if (sql.includes('select started_at, finished_at')) {
        return Promise.resolve({
          rows: [{ started_at: new Date().toISOString(), finished_at: null }],
        });
      }
      if (sql.includes('select count')) {
        // Force max-items condition
        return Promise.resolve({ rows: [{ n: MAX_ASSESSMENT_ITEMS.toString() }] });
      }
      return Promise.resolve({ rows: [] });
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    withTransaction: vi.fn(async (callback: any) =>
      callback({
        query: vi.fn((sql: string) => {
          if (sql.includes('select started_at, finished_at')) {
            return Promise.resolve({
              rows: [
                { started_at: new Date().toISOString(), finished_at: null, job_id: 'finance-ap' },
              ],
            });
          }
          if (sql.includes('select count')) {
            return Promise.resolve({ rows: [{ n: MAX_ASSESSMENT_ITEMS }] });
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

describe('assessments route', () => {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await app.register(registerAssessments as any, {
      prefix: '/assessments',
      scoringService: fakeScoring,
      llmAdapter: fakeLLMAdapter,
    });
    await app.ready();
  });

  it('enforces MAX_ASSESSMENT_ITEMS stop rule', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/assessments/submit',
      headers: {
        'X-Dev-Mode': 'true',
      },
      payload: {
        assessmentId: '00000000-0000-0000-0000-000000000000',
        itemId: 'q_e1a1b2c3',
        answerText: 'hello',
        clientTs: new Date().toISOString(),
        signals: [],
      },
    });
    expect(res.statusCode).toBe(410);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('AssessmentFinished');
  });

  it('allows submission when items < MAX_ASSESSMENT_ITEMS', async () => {
    const { query, withTransaction } = await import('../db');
    const queryMock = vi.mocked(query);
    const withTransactionMock = vi.mocked(withTransaction);

    // Mock query to return a lower count
    queryMock.mockResolvedValue({
      rows: [{ n: MAX_ASSESSMENT_ITEMS - 1 }],
    } as never);

    // Mock withTransaction to allow insert
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    withTransactionMock.mockImplementation(async (callback: any) =>
      callback({
        query: vi.fn((sql: string) => {
          if (sql.includes('select started_at, finished_at')) {
            return Promise.resolve({
              rows: [
                { started_at: new Date().toISOString(), finished_at: null, job_id: 'finance-ap' },
              ],
            });
          }
          if (sql.includes('select count')) {
            return Promise.resolve({ rows: [{ n: MAX_ASSESSMENT_ITEMS - 1 }] });
          }
          if (sql.includes('insert into item_events')) {
            return Promise.resolve({ rows: [{ id: 'item-1' }] });
          }
          return Promise.resolve({ rows: [] });
        }),
      }),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/assessments/submit',
      headers: {
        'X-Dev-Mode': 'true',
      },
      payload: {
        assessmentId: '00000000-0000-0000-0000-000000000000',
        itemId: 'q_e1a1b2c3',
        answerText: 'hello',
        clientTs: new Date().toISOString(),
        signals: [],
      },
    });
    // Should succeed (not 410)
    expect(res.statusCode).toBe(200);
  });

  it('returns assessment duration from GET endpoint', async () => {
    // Mock the query to return a duration
    // Since we're using vi.mocked query, we need to configure it for this test
    const { query } = await import('../db');
    const queryMock = vi.mocked(query);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryMock.mockResolvedValueOnce({
      rows: [{ duration_minutes: 20 }],
    } as never);

    const res = await app.inject({
      method: 'GET',
      url: '/assessments/00000000-0000-0000-0000-000000000000',
      headers: {
        'X-Dev-Mode': 'true',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({
      ok: true,
      duration_minutes: 20,
    });
  });

  it('returns not found when assessment does not exist', async () => {
    const { query } = await import('../db');
    const queryMock = vi.mocked(query);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryMock.mockResolvedValueOnce({
      rows: [],
    } as never);

    const res = await app.inject({
      method: 'GET',
      url: '/assessments/00000000-0000-0000-0000-000000000000',
      headers: {
        'X-Dev-Mode': 'true',
      },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('AssessmentNotFound');
  });
});
