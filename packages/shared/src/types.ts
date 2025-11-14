export interface BarsCriterionScore {
  policyProcedure: 0 | 1 | 2 | 3;
  decisionQuality: 0 | 1 | 2 | 3;
  evidenceSpecificity: 0 | 1 | 2 | 3;
}

export interface BarsQuestionScore {
  total: number; // 0–9
  criteria: BarsCriterionScore;
}
