import { z } from 'zod';

export const IssueMagicLinkRequest = z.object({
  email: z.string().email().max(254),
  jobId: z.string().min(1).max(50),
});
export type IssueMagicLinkRequest = z.infer<typeof IssueMagicLinkRequest>;

export const IssueMagicLinkResponse = z.object({
  ok: z.literal(true),
  magicLinkId: z.string(),
  email: z.string().email(),
});
export type IssueMagicLinkResponse = z.infer<typeof IssueMagicLinkResponse>;

export const ConsumeMagicLinkRequest = z.object({
  token: z.string().min(10),
});
export type ConsumeMagicLinkRequest = z.infer<typeof ConsumeMagicLinkRequest>;

export const ConsumeMagicLinkResponse = z.object({
  ok: z.literal(true),
  assessmentId: z.string().uuid(),
  sessionToken: z.string().min(1),
});
export type ConsumeMagicLinkResponse = z.infer<typeof ConsumeMagicLinkResponse>;

export const SubmitAnswerRequest = z.object({
  assessmentId: z.string().uuid(),
  itemId: z.string().regex(/^q_[a-f0-9]{8}$/, 'itemId must match format q_[8 hex chars]'),
  answerText: z.string().min(1).max(5000),
  questionText: z.string().max(2000).optional(), // Question text for LLM-generated questions
  clientTs: z.string().datetime(),
  signals: z
    .array(
      z.object({
        type: z.enum(['visibilitychange', 'paste', 'blur', 'focus', 'latencyOutlier']),
        at: z.string().datetime(),
        meta: z.record(z.any()).optional(),
      }),
    )
    .default([]),
});
export type SubmitAnswerRequest = z.infer<typeof SubmitAnswerRequest>;

export const SubmitAnswerResponse = z.object({
  ok: z.literal(true),
  score: z.object({
    total: z.number(),
    criteria: z.object({
      policyProcedure: z.number(),
      decisionQuality: z.number(),
      evidenceSpecificity: z.number(),
    }),
  }),
  followUp: z.string(),
  timeRemaining: z.number().optional(), // Time remaining in seconds
});
export type SubmitAnswerResponse = z.infer<typeof SubmitAnswerResponse>;

// Integrity event schema for beacons and server validation
export const IntegrityEventSchema = z.object({
  type: z.enum(['visibilitychange', 'paste', 'blur', 'focus', 'latencyOutlier']),
  at: z.string().datetime().optional(),
  itemId: z.string().optional(),
  meta: z.record(z.any()).optional(),
});
export type IntegrityEventInput = z.infer<typeof IntegrityEventSchema>;

export const DevTestAssessmentRequest = z.object({
  jobId: z.string().min(1).optional(),
});
export type DevTestAssessmentRequest = z.infer<typeof DevTestAssessmentRequest>;

export const NextQuestionRequest = z.object({
  assessmentId: z.string().uuid(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
});
export type NextQuestionRequest = z.infer<typeof NextQuestionRequest>;

export const NextQuestionResponse = z.object({
  ok: z.literal(true),
  question: z.string(),
  itemId: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  timeRemaining: z.number().optional(), // Time remaining in seconds
  isFirstQuestion: z.boolean().optional(),
});
export type NextQuestionResponse = z.infer<typeof NextQuestionResponse>;

/**
 * Validates if a string is a valid UUID v4
 */
export function isValidUUID(str: string): boolean {
  return z.string().uuid().safeParse(str).success;
}
