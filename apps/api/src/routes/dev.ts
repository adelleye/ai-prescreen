import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { query } from '../db';
import { DevTestAssessmentRequest } from '@shared/core';
import { sendError } from '../services/errors';
import { OpenAIAdapter } from '../llm/openaiProvider';

/**
 * Dev-only routes for testing (disabled in production)
 */
export async function registerDev(app: FastifyInstance, _opts: FastifyPluginOptions) {
  // Only enable in development - stricter check to prevent production exposure
  // Check both NODE_ENV and VERCEL env vars for safety
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  if (isProduction) {
    return;
  }

  /**
   * POST /dev/test-assessment
   * Creates a test assessment directly (bypasses magic link flow)
   * Returns: { ok: true, assessmentId: string, testUrl: string }
   */
  app.post('/test-assessment', async (req, reply) => {
    const parsed = DevTestAssessmentRequest.safeParse(req.body);
    if (!parsed.success) {
      sendError(reply, 400, 'BadRequest', undefined, req);
      return;
    }
    const jobId = parsed.data.jobId ?? 'finance-ap';
    
    // Create assessment directly
    const { rows } = await query<{ id: string }>(
      `insert into assessments (job_id, candidate_id, created_at)
       values ($1, gen_random_uuid(), now()) returning id`,
      [jobId],
    );
    
    if (rows.length === 0) {
      sendError(reply, 500, 'Failed to create assessment', undefined, req);
      return;
    }
    
    const inserted = rows[0];
    if (!inserted) {
      sendError(reply, 500, 'Failed to create assessment', undefined, req);
      return;
    }
    const assessmentId = inserted.id;
    const webBaseUrl = process.env.WEB_BASE_URL || 'http://localhost:3000';
    const testUrl = `${webBaseUrl}/assessment?devAssessmentId=${assessmentId}`;
    
    return {
      ok: true,
      assessmentId,
      testUrl,
    };
  });

  /**
   * POST /dev/test-llm
   * Tests LLM question generation directly (no database required)
   * Body: { jobContext?: string, applicantContext?: string, difficulty?: 'easy' | 'medium' | 'hard' }
   * Returns: { ok: true, question: string, itemId: string, difficulty: string }
   */
  app.post('/test-llm', async (req, reply) => {
    try {
      const body = req.body as {
        jobContext?: string;
        applicantContext?: string;
        difficulty?: 'easy' | 'medium' | 'hard';
        history?: Array<{ question: string; answer: string }>;
      };

      const llmAdapter = new OpenAIAdapter();
      const result = await llmAdapter.generateQuestion({
        jobContext: body.jobContext || 'Software Engineer position at a tech company',
        applicantContext: body.applicantContext || 'Candidate with 5 years of experience',
        history: body.history || [],
        ...(body.difficulty && { difficulty: body.difficulty }),
      });

      return {
        ok: true,
        question: result.question,
        itemId: result.itemId,
        difficulty: result.difficulty,
      };
    } catch (err) {
      req.log.error({ err }, 'LLM test failed');
      if (err instanceof Error && err.name === 'LLMConfigurationError') {
        sendError(
          reply,
          500,
          'LLMConfigurationMissing',
          'OpenAI API key or model not configured. Please set LLM_API_KEY and LLM_MODEL_PRIMARY in environment variables.',
          req,
          err,
        );
        return;
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      sendError(reply, 500, 'LLMTestFailed', errorMessage, req, err);
      return;
    }
  });
}

