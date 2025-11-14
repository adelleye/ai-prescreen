import { describe, expect, it, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { registerAssessments } from './assessments';

vi.mock('../db', () => {
  // Provide a mutable sequence of results for successive calls
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
        return Promise.resolve({ rows: [{ n: '18' }] });
      }
      return Promise.resolve({ rows: [] });
    }),
    withTransaction: vi.fn(async (callback: any) => callback({
      query: vi.fn((sql: string) => {
        if (sql.includes('select started_at, finished_at')) {
          return Promise.resolve({
            rows: [{ started_at: new Date().toISOString(), finished_at: null, job_id: 'finance-ap' }],
          });
        }
        if (sql.includes('select count')) {
          return Promise.resolve({ rows: [{ n: 18 }] });
        }
        if (sql.includes('update assessments')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('insert into item_events')) {
          return Promise.resolve({ rows: [{ id: 'item-1' }] });
        }
        return Promise.resolve({ rows: [] });
      }),
    })),
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
    await app.register(registerAssessments as any, {
      prefix: '/assessments',
      scoringService: fakeScoring,
      llmAdapter: fakeLLMAdapter,
    });
    await app.ready();
  });

  it('enforces max-18 stop rule', async () => {
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
  });
});
