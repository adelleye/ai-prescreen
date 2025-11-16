import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../db', () => {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('avg(')) {
        return { rows: [{ avg_total: '6' }] }; // average per-item total 6/9 -> 67
      }
      // events query
      return {
        rows: [
          { events: [{ type: 'paste', at: new Date().toISOString(), itemId: 'q_x' }] },
          { events: [{ type: 'visibilitychange', at: new Date().toISOString(), itemId: 'q_y' }] },
        ],
      };
    }),
  };
});

describe('getAssessmentSummary', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('computes totalScore and integrity from DB', async () => {
    const { getAssessmentSummary } = await import('./reportSummary');
    const res = await getAssessmentSummary('a1');
    expect(res.totalScore).toBe(Math.round((6 / 9) * 100));
    expect(res.integrity.band).toBeTypeOf('string');
    expect(Array.isArray(res.integrity.reasons)).toBe(true);
  });
});
