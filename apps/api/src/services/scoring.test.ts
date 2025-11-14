import { describe, it, expect } from 'vitest';

import type { LlmAdapter } from '../llm/adapter';

import { createScoringService } from './scoring';

describe('scoring service', () => {
  it('computes total and uses tie-breaker when agreement is low', async () => {
    const adapter: LlmAdapter = {
      async gradeAnswer({ seed }) {
        if (seed === 1) {
          return {
            criteria: { policyProcedure: 1, decisionQuality: 1, evidenceSpecificity: 1 },
          };
        }
        if (seed === 2) {
          return {
            criteria: { policyProcedure: 1, decisionQuality: 1, evidenceSpecificity: 0 },
          };
        }
        // tie-breaker
        return {
          criteria: { policyProcedure: 1, decisionQuality: 1, evidenceSpecificity: 1 },
          followUp: 'Be specific.',
        };
      },
      async generateQuestion() {
        return { question: 'test', itemId: 'test', difficulty: 'easy' };
      },
    };
    const service = createScoringService(adapter);
    const res = await service.gradeAndScoreAnswer({
      itemId: 'x',
      prompt: 'Q',
      answer: 'A',
    });
    // total based on chosen criteria (1+1+1)
    expect(res.total).toBe(3);
    // kappa should be 2/3 (~0.666) which is < 0.67, so tie-breaker path triggers
    expect(res.kappa).toBeLessThan(0.67);
    // followUp borrowed from tie-breaker when chosen lacked one
    expect(res.followUp).toBe('Be specific.');
  });
});
