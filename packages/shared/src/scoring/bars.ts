import type { BarsCriterionScore, BarsQuestionScore } from '../types';

export function scoreBarsCriterion(input: BarsCriterionScore): BarsQuestionScore {
  const total = input.policyProcedure + input.decisionQuality + input.evidenceSpecificity;
  return { total, criteria: input };
}

