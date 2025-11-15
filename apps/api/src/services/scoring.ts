import { scoreBarsCriterion } from '@shared/core';

import type { LlmAdapter } from '../llm/adapter';

export type GradeOutcome = {
  criteria: { policyProcedure: number; decisionQuality: number; evidenceSpecificity: number };
  total: number;
  followUp: string;
  kappa?: number;
};

function computeAgreement(a: { [k: string]: number }, b: { [k: string]: number }): number {
  const keys: Array<keyof typeof a> = ['policyProcedure', 'decisionQuality', 'evidenceSpecificity'];
  let agree = 0;
  for (const k of keys) {
    if (a[k] === b[k]) agree++;
  }
  return agree / keys.length;
}

export function createScoringService(adapter: LlmAdapter) {
  return {
    async gradeAndScoreAnswer(input: {
      itemId: string;
      prompt: string;
      answer: string;
      timeoutMs?: number;
      jobContext?: string;
      applicantContext?: string;
      history?: Array<{ question: string; answer: string }>;
    }): Promise<GradeOutcome> {
      // Two-pass with deterministic seeds in parallel; tie-breaker if low agreement
      const [pass1, pass2] = await Promise.all([
        adapter.gradeAnswer({
          itemId: input.itemId,
          prompt: input.prompt,
          answer: input.answer,
          seed: 1,
          ...(input.jobContext && { jobContext: input.jobContext }),
          ...(input.applicantContext && { applicantContext: input.applicantContext }),
          ...(input.history && { history: input.history }),
          ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
        }),
        adapter.gradeAnswer({
          itemId: input.itemId,
          prompt: input.prompt,
          answer: input.answer,
          seed: 2,
          ...(input.jobContext && { jobContext: input.jobContext }),
          ...(input.applicantContext && { applicantContext: input.applicantContext }),
          ...(input.history && { history: input.history }),
          ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
        }),
      ]);

      const agreement = computeAgreement(pass1.criteria, pass2.criteria);
      let chosen = pass1;
      if (agreement < 0.67) {
        // Low agreement → tie-breaker (seed 3)
        const tie = await adapter.gradeAnswer({
          itemId: input.itemId,
          prompt: input.prompt,
          answer: input.answer,
          seed: 3,
          ...(input.jobContext && { jobContext: input.jobContext }),
          ...(input.applicantContext && { applicantContext: input.applicantContext }),
          ...(input.history && { history: input.history }),
          ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
        });
        // Choose the result (pass1 or pass2) that is closest to tie-breaker by L1 distance
        const dist = (x: typeof tie.criteria) =>
          Math.abs(x.policyProcedure - tie.criteria.policyProcedure) +
          Math.abs(x.decisionQuality - tie.criteria.decisionQuality) +
          Math.abs(x.evidenceSpecificity - tie.criteria.evidenceSpecificity);
        chosen = dist(pass1.criteria) <= dist(pass2.criteria) ? pass1 : pass2;
        // Borrow followUp from tie-breaker if present and chosen lacks one
        if (!chosen.followUp && tie.followUp) {
          chosen = { ...chosen, followUp: tie.followUp };
        }
      }

      const score = scoreBarsCriterion({
        policyProcedure: chosen.criteria.policyProcedure as 0 | 1 | 2 | 3,
        decisionQuality: chosen.criteria.decisionQuality as 0 | 1 | 2 | 3,
        evidenceSpecificity: chosen.criteria.evidenceSpecificity as 0 | 1 | 2 | 3,
      });

      return {
        criteria: score.criteria,
        total: score.total,
        followUp: chosen.followUp,
        kappa: agreement,
      };
    },
  };
}
