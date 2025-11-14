/* eslint-disable @typescript-eslint/no-explicit-any */
import Fastify from 'fastify';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { registerAssessments } from './assessments';

const queryMock = vi.fn();
vi.mock('../db', () => {
  return {
    query: (...args: any[]) => queryMock(...args),
    withTransaction: vi.fn(async (callback: any) =>
      callback({
        query: vi.fn((sql: string) => {
          if (sql.includes('select started_at')) {
            return Promise.resolve({
              rows: [
                { started_at: new Date().toISOString(), finished_at: null, job_id: 'finance-ap' },
              ],
            });
          }
          if (sql.includes('select count')) {
            return Promise.resolve({ rows: [{ n: 0 }] });
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

describe('assessments route persistence', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    queryMock.mockReset();
    // First call (metadata) returns started_at now and count 0
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes('with up as')) {
        return Promise.resolve({
          rows: [
            { started_at: new Date().toISOString(), finished_at: null, n: 0, job_id: 'finance-ap' },
          ],
        });
      }
      if (sql.startsWith('insert into item_events')) {
        return Promise.resolve({ rows: [{ id: 'item-1' }] });
      }
      if (sql.includes('select') && sql.includes('response')) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes('update item_events')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });
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

  it('persists item_events with score JSON including total', async () => {
    const payload = {
      assessmentId: '00000000-0000-0000-0000-000000000000',
      itemId: 'q_e1a1b2c3',
      answerText: 'hello',
      clientTs: new Date().toISOString(),
      signals: [],
    };
    const res = await app.inject({
      method: 'POST',
      url: '/assessments/submit',
      headers: {
        'X-Dev-Mode': 'true',
      },
      payload,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload || '{}');
    expect(body.ok).toBe(true);
    expect(body.score).toBeDefined();
    expect(body.score.total).toBe(6);
    expect(body.score.criteria).toEqual({
      policyProcedure: 2,
      decisionQuality: 2,
      evidenceSpecificity: 2,
    });
  });
});
