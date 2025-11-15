export interface LlmAdapter {
  gradeAnswer(input: {
    itemId: string;
    prompt: string;
    answer: string;
    seed: number;
    timeoutMs?: number;
    jobContext?: string;
    applicantContext?: string;
    history?: Array<{ question: string; answer: string }>;
  }): Promise<{
    criteria: {
      policyProcedure: 0 | 1 | 2 | 3;
      decisionQuality: 0 | 1 | 2 | 3;
      evidenceSpecificity: 0 | 1 | 2 | 3;
    };
    followUp: string;
  }>;

  generateQuestion(input: {
    jobContext: string;
    applicantContext: string;
    history: Array<{ question: string; answer: string }>;
    difficulty?: 'easy' | 'medium' | 'hard';
    timeoutMs?: number;
  }): Promise<{
    question: string;
    itemId: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
}

export type BarsCriteria = {
  policyProcedure: 0 | 1 | 2 | 3;
  decisionQuality: 0 | 1 | 2 | 3;
  evidenceSpecificity: 0 | 1 | 2 | 3;
};
