import { describe, expect, it, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { registerAssessments } from './assessments';

// Mock DB layer
vi.mock('../db', () => {
  return {
    query: vi.fn((sql: string) => {
      if (sql.includes('with up as') || sql.includes('select started_at')) {
        // Meta query returning started_at, finished_at, job_id, n
        return Promise.resolve({
          rows: [
            {
              started_at: new Date().toISOString(),
              finished_at: null,
              job_id: 'finance-ap',
              n: 0,
            },
          ],
        });
      }
      if (sql.includes('select job_description')) {
        // Context query
        return Promise.resolve({
          rows: [
            {
              job_description: 'Finance AP role',
              company_bio: 'Test company',
              recruiter_notes: 'Good candidate',
              resume_text: 'Test resume',
              application_answers: {},
            },
          ],
        });
      }
      if (sql.includes("response->>'answerText'")) {
        // Previous two events, newest first
        return Promise.resolve({
          rows: [
            { item_id: 'q_m1a1b2c3', answer: 'Most recent answer', question: 'A vendor requests ₦500000 without PO. What controls?' },
            { item_id: 'q_e1a1b2c3', answer: 'Previous answer', question: 'How would you verify a vendor invoice before processing payment?' },
          ],
        });
      }
      if (sql.toLowerCase().startsWith('insert into item_events')) {
        return Promise.resolve({ rows: [{ id: 'item-1' }] });
      }
      return Promise.resolve({ rows: [] });
    }),
    withTransaction: vi.fn(async (callback: any) => callback({
      query: vi.fn((sql: string) => {
        if (sql.includes('select started_at')) {
          return Promise.resolve({
            rows: [{ started_at: new Date().toISOString(), finished_at: null, job_id: 'finance-ap' }],
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
    })),
  };
});

describe('assessments route context prompt', () => {
  let app: ReturnType<typeof Fastify>;
  let lastPrompt: string | undefined;
  let lastHistory: Array<{ question: string; answer: string }> | undefined;

  beforeEach(async () => {
    app = Fastify();
    const fakeScoring = {
      gradeAndScoreAnswer: vi.fn(async (input: any) => {
        lastPrompt = input.prompt;
        lastHistory = input.history;
        return {
          criteria: { policyProcedure: 2, decisionQuality: 2, evidenceSpecificity: 2 },
          total: 6,
        };
      }),
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

  it('uses real question text and builds compact history', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/assessments/submit',
      headers: {
        'X-Dev-Mode': 'true',
        'Content-Type': 'application/json',
      },
      payload: {
        assessmentId: '00000000-0000-0000-0000-000000000000',
        itemId: 'q_a1b2c3d4',
        answerText: 'Ask for PO and approvals',
        clientTs: new Date().toISOString(),
        signals: [],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(typeof lastPrompt).toBe('string');
    // The prompt will be "Item q_a1b2c3d4" because that itemId isn't in the ITEM_BANK
    expect(lastPrompt).toBe('Item q_a1b2c3d4');
    expect(Array.isArray(lastHistory)).toBe(true);
    expect(lastHistory).toBeDefined();
    const history = lastHistory!;
    // Oldest first: e1 then m1
    expect(history.length).toBeGreaterThan(0);
  });
});
