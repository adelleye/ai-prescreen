import type { FastifyInstance, FastifyPluginOptions } from 'fastify';

import { query, withTransaction } from '../db';
import { OpenAIAdapter } from '../llm/openaiProvider';
import { sendError } from '../services/errors';

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
   * Body: {
   *   jobId?: string,
   *   candidateName?: string,
   *   resumeText?: string,
   *   jobDescription?: string,
   *   companyBio?: string,
   *   recruiterNotes?: string,
   *   applicationAnswers?: Record<string, unknown>,
   *   durationMinutes?: number
   * }
   * Returns: { ok: true, assessmentId: string, testUrl: string }
   */
  app.post('/test-assessment', async (req, reply) => {
    // For dev endpoints, accept additional fields beyond the base schema
    const body = req.body as {
      jobId?: string;
      candidateName?: string;
      resumeText?: string;
      jobDescription?: string;
      companyBio?: string;
      recruiterNotes?: string;
      applicationAnswers?: Record<string, unknown>;
      durationMinutes?: number;
    };

    const jobId = body.jobId ?? 'finance-ap';

    // Create assessment with optional context fields
    const { rows } = await query<{ id: string }>(
      `insert into assessments (
         job_id, candidate_id, created_at, candidate_name, resume_text,
         job_description, company_bio, recruiter_notes, application_answers, duration_minutes
       ) values ($1, gen_random_uuid(), now(), $2, $3, $4, $5, $6, $7, $8)
       returning id`,
      [
        jobId,
        body.candidateName ?? null,
        body.resumeText ?? null,
        body.jobDescription ?? null,
        body.companyBio ?? null,
        body.recruiterNotes ?? null,
        body.applicationAnswers ? JSON.stringify(body.applicationAnswers) : null,
        body.durationMinutes ?? 15,
      ],
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
   * GET /dev/test-assessment/:assessmentId
   * Retrieve assessment data for viewing/editing
   * Returns: assessment data including all context fields
   */
  app.get('/test-assessment/:assessmentId', async (req, reply) => {
    const { assessmentId } = req.params as { assessmentId: string };

    const { rows } = await query(
      `select
         id, job_id, candidate_name, resume_text, job_description,
         company_bio, recruiter_notes, application_answers, duration_minutes,
         started_at, finished_at, stop_reason
       from assessments where id = $1`,
      [assessmentId],
    );

    if (rows.length === 0 || !rows[0]) {
      sendError(reply, 404, 'NotFound', 'Assessment not found', req);
      return;
    }

    const assessment = rows[0] as {
      id: string;
      job_id: string;
      candidate_name: string | null;
      resume_text: string | null;
      job_description: string | null;
      company_bio: string | null;
      recruiter_notes: string | null;
      application_answers: string | null;
      duration_minutes: number;
      started_at: string | null;
      finished_at: string | null;
      stop_reason: string | null;
    };
    return {
      ok: true,
      assessment: {
        id: assessment.id,
        jobId: assessment.job_id,
        candidateName: assessment.candidate_name,
        resumeText: assessment.resume_text,
        jobDescription: assessment.job_description,
        companyBio: assessment.company_bio,
        recruiterNotes: assessment.recruiter_notes,
        applicationAnswers: assessment.application_answers
          ? typeof assessment.application_answers === 'string'
            ? JSON.parse(assessment.application_answers)
            : assessment.application_answers
          : null,
        durationMinutes: assessment.duration_minutes,
        startedAt: assessment.started_at,
        finishedAt: assessment.finished_at,
        stopReason: assessment.stop_reason,
      },
    };
  });

  /**
   * PUT /dev/test-assessment/:assessmentId
   * Update assessment context fields for testing different scenarios
   * Body: same as POST /dev/test-assessment
   * Returns: { ok: true }
   */
  app.put('/test-assessment/:assessmentId', async (req, _reply) => {
    const { assessmentId } = req.params as { assessmentId: string };
    const body = req.body as {
      candidateName?: string | null;
      resumeText?: string | null;
      jobDescription?: string | null;
      companyBio?: string | null;
      recruiterNotes?: string | null;
      applicationAnswers?: Record<string, unknown> | null;
      durationMinutes?: number;
    };

    type UpdateTuple = [string, unknown];
    const updates: UpdateTuple[] = [];
    const params: unknown[] = [assessmentId];

    if (body.candidateName !== undefined) {
      updates.push(['candidate_name', body.candidateName]);
      params.push(body.candidateName);
    }
    if (body.resumeText !== undefined) {
      updates.push(['resume_text', body.resumeText]);
      params.push(body.resumeText);
    }
    if (body.jobDescription !== undefined) {
      updates.push(['job_description', body.jobDescription]);
      params.push(body.jobDescription);
    }
    if (body.companyBio !== undefined) {
      updates.push(['company_bio', body.companyBio]);
      params.push(body.companyBio);
    }
    if (body.recruiterNotes !== undefined) {
      updates.push(['recruiter_notes', body.recruiterNotes]);
      params.push(body.recruiterNotes);
    }
    if (body.applicationAnswers !== undefined) {
      const jsonStr = body.applicationAnswers ? JSON.stringify(body.applicationAnswers) : null;
      updates.push(['application_answers', jsonStr]);
      params.push(jsonStr);
    }
    if (body.durationMinutes !== undefined) {
      updates.push(['duration_minutes', body.durationMinutes]);
      params.push(body.durationMinutes);
    }

    if (updates.length === 0) {
      return { ok: true, message: 'No fields to update' };
    }

    const setClause = updates.map((u, i) => `${u[0]} = $${i + 2}`).join(', ');
    const sql = `update assessments set ${setClause} where id = $1`;

    await query(sql, params);

    return { ok: true };
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

  /**
   * PUT /dev/test-assessment/:assessmentId/reset
   * Resets a test assessment for re-running (dev mode only)
   * Clears: started_at, finished_at, stop_reason, and all item_events (questions/answers)
   * Preserves: all context fields (resume, job description, candidate name, etc.)
   * Returns: { ok: true }
   *
   * This enables rapid iteration during development — run the same assessment multiple times
   * without having to create new assessments. The timer will reset on page reload because
   * duration_minutes is fetched fresh from the database.
   */
  app.put('/test-assessment/:assessmentId/reset', async (req, reply) => {
    const { assessmentId } = req.params as { assessmentId: string };

    try {
      await withTransaction(async (client) => {
        // Delete all item events (questions/answers) for this assessment
        await client.query('delete from item_events where assessment_id = $1', [assessmentId]);

        // Reset assessment state
        await client.query(
          `update assessments
           set started_at = null, finished_at = null, stop_reason = null
           where id = $1`,
          [assessmentId],
        );
      });

      return { ok: true };
    } catch (err) {
      req.log.error(
        {
          event: 'assessment_reset_failed',
          assessmentId,
          error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
        },
        'Failed to reset assessment',
      );
      sendError(reply, 500, 'ResetFailed', 'Failed to reset assessment', req, err);
    }
  });
}
