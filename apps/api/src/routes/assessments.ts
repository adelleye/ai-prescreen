import {
  SubmitAnswerRequest,
  NextQuestionRequest,
  getQuestionText,
  MAX_ASSESSMENT_ITEMS,
} from '@shared/core';
import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';

import { query, withTransaction } from '../db';
import {
  checkStopRules,
  fetchAssessmentContext,
  fetchAssessmentMetadata,
  validateAssessmentActive,
  buildQuestionHistory,
  calculateTimeRemaining,
  secondsToMinutes,
} from '../services/assessmentHelpers';
import { requireSession } from '../services/auth';
import {
  buildJobContext,
  buildApplicantContext,
  type AssessmentContext,
} from '../services/contextBuilder';
import { sendError } from '../services/errors';
import type { GradeOutcome } from '../services/scoring';

interface Session {
  assessmentId: string;
}

interface RequestWithSession extends FastifyRequest {
  session?: Session;
}

function buildContexts(context: AssessmentContext, jobId: string) {
  const jobContext = buildJobContext({
    jobDescription: context.job_description ?? undefined,
    companyBio: context.company_bio ?? undefined,
    recruiterNotes: context.recruiter_notes ?? undefined,
    jobId,
  });

  const applicantContext = buildApplicantContext({
    candidateName: context.candidate_name ?? undefined,
    resumeText: context.resume_text ?? undefined,
    applicationAnswers: context.application_answers ?? undefined,
    jobId,
  });

  const candidateName = context.candidate_name ?? null;

  return {
    jobContext,
    applicantContext,
    ...(candidateName && { candidateName }),
  };
}

const registerAssessments: FastifyPluginAsync<{
  scoringService: {
    gradeAndScoreAnswer: (input: {
      itemId: string;
      prompt: string;
      answer: string;
      timeoutMs?: number;
      jobContext?: string;
      applicantContext?: string;
      history?: Array<{ question: string; answer: string }>;
      timeRemaining?: number;
    }) => Promise<GradeOutcome>;
  };
  llmAdapter: {
    generateQuestion: (input: {
      jobContext: string;
      applicantContext: string;
      history: Array<{ question: string; answer: string }>;
      difficulty?: 'easy' | 'medium' | 'hard';
      timeoutMs?: number;
      timeRemaining?: number;
      itemNumber?: number;
      maxItems?: number;
      isFirstQuestion?: boolean;
      candidateName?: string | null;
      resumeText?: string | null;
    }) => Promise<{
      question: string;
      itemId: string;
      difficulty: 'easy' | 'medium' | 'hard';
    }>;
  };
}> = async function registerAssessments(app: FastifyInstance, opts) {
  // Test route to verify plugin registration (before auth middleware)
  app.get('/test', async (_req, _reply) => {
    return { ok: true, message: 'Assessment routes are working' };
  });

  // Fetch assessment details including duration and candidate name (no auth required - needed for UI setup)
  app.get('/:assessmentId', async (req, reply) => {
    const { assessmentId } = req.params as { assessmentId: string };

    try {
      const { rows } = await query<{
        duration_minutes: number | null;
        candidate_name: string | null;
      }>('select duration_minutes, candidate_name from assessments where id = $1', [assessmentId]);

      if (rows.length === 0) {
        sendError(reply, 404, 'AssessmentNotFound', undefined, req);
        return;
      }

      return {
        ok: true,
        duration_minutes: rows[0]?.duration_minutes ?? 15,
        candidate_name: rows[0]?.candidate_name ?? undefined,
      };
    } catch (err) {
      sendError(reply, 500, 'InternalError', undefined, req, err);
    }
  });

  // Per-assessment rate limiting middleware (applies to POST/PUT routes below)
  app.addHook('preHandler', async (req, reply) => {
    // Session validation - skip for GET requests
    if (req.method === 'GET') {
      return; // GET requests don't require auth
    }

    // Session validation for POST/PUT
    const isDev = process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1';
    if (!(isDev && req.headers['x-dev-mode'] === 'true')) {
      const session = await requireSession(req, reply);
      if (!session) {
        return; // Error already sent by requireSession
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (req as any).session = session;
    }
  });

  app.log.info('Registering assessment routes: /submit and /next-question');

  app.post(
    '/submit',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
          keyGenerator: (req: FastifyRequest) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const session = (req as RequestWithSession).session;
            const body = req.body as { assessmentId?: string } | undefined;
            const aid = session?.assessmentId || body?.assessmentId || 'unknown';
            return `assess:${aid}`;
          },
        },
      },
    },
    async (req, reply) => {
      const parsed = SubmitAnswerRequest.safeParse(req.body);
      if (!parsed.success) {
        sendError(reply, 400, 'BadRequest', undefined, req);
        return;
      }
      const { assessmentId, itemId, answerText, questionText, signals } = parsed.data;

      // Verify session matches assessmentId from request (skip in dev mode)
      const isDev = process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1';
      if (!(isDev && req.headers['x-dev-mode'] === 'true')) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = (req as RequestWithSession).session;
        if (!session || session.assessmentId !== assessmentId) {
          sendError(reply, 403, 'Forbidden', 'Session does not match assessment', req);
          return;
        }
      }

      // Ensure assessment exists & set started_at if first submit; also fetch counts in one round-trip
      const metaRows = await fetchAssessmentMetadata(assessmentId, true);
      const meta = validateAssessmentActive(metaRows);
      if (!meta) {
        if (metaRows.length === 0) {
          sendError(reply, 404, 'AssessmentNotFound', undefined, req);
          return;
        }
        // Log assessment finished event
        req.log.info(
          {
            event: 'assessment_finished',
            assessmentId,
            requestId: req.id,
          },
          'Assessment already finished',
        );
        sendError(reply, 410, 'AssessmentFinished', undefined, req);
        return;
      }

      // Log assessment started if this is the first submit
      if (!meta.started_at || meta.n === 0) {
        req.log.info(
          {
            event: 'assessment_started',
            assessmentId,
            requestId: req.id,
          },
          'Assessment started',
        );
      }

      // Perform stop-rule check and insert within a single transaction with row lock
      let itemEventId: string | undefined;
      let finalQuestionText: string | undefined;
      try {
        const result = await withTransaction(async (client) => {
          // Lock assessment row
          const { rows: arows } = await client.query<{
            started_at: string | null;
            finished_at: string | null;
            job_id: string;
          }>('select started_at, finished_at, job_id from assessments where id = $1 for update', [
            assessmentId,
          ]);
          const a = arows[0];
          if (!a) {
            throw new Error('AssessmentNotFound');
          }
          if (a.finished_at) {
            throw new Error('AssessmentFinished');
          }
          // Count existing items
          const { rows: crows } = await client.query<{ n: number }>(
            'select count(1)::int as n from item_events where assessment_id = $1',
            [assessmentId],
          );
          const numItems = Number(crows[0]?.n ?? 0);
          if (Number.isFinite(numItems) && numItems >= MAX_ASSESSMENT_ITEMS) {
            await client.query(
              'update assessments set finished_at = now(), stop_reason = $2 where id = $1 and finished_at is null',
              [assessmentId, 'MAX_ITEMS'],
            );
            await client.query(
              'update sessions set revoked_at = now() where assessment_id = $1 and revoked_at is null',
              [assessmentId],
            );
            throw new Error('MaxItemsReached');
          }
          // Prepare question text using shared bank if needed
          const jobId = a.job_id;
          finalQuestionText = questionText ?? getQuestionText(jobId, itemId) ?? `Item ${itemId}`;
          // Insert item event minimally (score added later)
          const { rows: irows } = await client.query<{ id: string }>(
            `insert into item_events (assessment_id, item_id, t_start, response, events)
           values ($1, $2, now(), $3::jsonb, $4::jsonb)
           returning id`,
            [
              assessmentId,
              itemId,
              JSON.stringify({ answerText, questionText: finalQuestionText }),
              JSON.stringify(signals),
            ],
          );
          const inserted = irows[0];
          if (!inserted) {
            throw new Error('InsertFailed');
          }
          return { itemEventId: inserted.id, jobId };
        });
        itemEventId = result.itemEventId;
        // Use LLM scoring service (two-pass + tie-breaker) outside the transaction
        const scoring = opts.scoringService;
        if (!scoring) {
          sendError(reply, 500, 'ScoringUnavailable', undefined, req);
          return;
        }
        // Build history compactly
        const { rows: prevRows } = await query<{
          item_id: string;
          answer: string | null;
          question: string | null;
        }>(
          `select
          item_id,
          response->>'answerText' as answer,
          response->>'questionText' as question
         from item_events
         where assessment_id = $1
         order by t_start desc
         limit 2`,
          [assessmentId],
        );
        const history = buildQuestionHistory(prevRows, meta.job_id, getQuestionText, 2);
        // Fetch context
        const context = await fetchAssessmentContext(assessmentId);
        const { jobContext, applicantContext } = buildContexts(context, meta.job_id);

        // Get duration and calculate time remaining for time-aware scoring
        const durationMinutes = context.duration_minutes ?? 15;
        const timeRemainingSeconds = calculateTimeRemaining(durationMinutes, meta.started_at);
        const timeRemainingMinutes =
          timeRemainingSeconds !== null ? secondsToMinutes(timeRemainingSeconds) : undefined;

        const outcome = await scoring.gradeAndScoreAnswer({
          itemId,
          prompt: finalQuestionText ?? `Item ${itemId}`,
          answer: answerText,
          ...(jobContext && { jobContext }),
          ...(applicantContext && { applicantContext }),
          ...(history && history.length > 0 && { history }),
          ...(timeRemainingMinutes !== undefined &&
            timeRemainingMinutes !== null && {
              timeRemaining: timeRemainingMinutes,
            }),
        });
        // Update item_event with score and t_end
        await withTransaction(async (client) => {
          await client.query(
            `update item_events
           set t_end = now(), score = $1::jsonb
           where id = $2`,
            [JSON.stringify({ total: outcome.total, criteria: outcome.criteria }), itemEventId],
          );
        });
        // Log answer scored event
        req.log.info(
          {
            event: 'answer_scored',
            assessmentId,
            itemId,
            score: outcome.total,
            requestId: req.id,
          },
          'Answer scored',
        );
        return {
          ok: true,
          score: { total: outcome.total, criteria: outcome.criteria },
          followUp: outcome.followUp,
          ...(timeRemainingSeconds !== null && { timeRemaining: Math.ceil(timeRemainingSeconds) }),
        };
      } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const error = err as any;
        if (error?.code === '23505') {
          // Unique constraint violation on (assessment_id, item_id)
          sendError(reply, 409, 'DuplicateSubmission', undefined, req);
          return;
        }
        if (error?.message === 'MaxItemsReached') {
          sendError(reply, 410, 'AssessmentFinished', undefined, req);
          return;
        }
        if (error?.message === 'AssessmentFinished') {
          sendError(reply, 410, 'AssessmentFinished', undefined, req);
          return;
        }
        throw err;
      }
    },
  );

  app.post(
    '/next-question',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
          keyGenerator: (req: FastifyRequest) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const session = (req as RequestWithSession).session;
            const body = req.body as { assessmentId?: string } | undefined;
            const aid = session?.assessmentId || body?.assessmentId || 'unknown';
            return `assess:${aid}`;
          },
        },
      },
    },
    async (req, reply) => {
      const parsed = NextQuestionRequest.safeParse(req.body);
      if (!parsed.success) {
        req.log.warn(
          {
            event: 'validation_failed',
            errors: parsed.error.errors,
            body: req.body,
            requestId: req.id,
          },
          'Next question request validation failed',
        );
        sendError(
          reply,
          400,
          'BadRequest',
          parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
          req,
        );
        return;
      }
      const { assessmentId, difficulty } = parsed.data;

      // Verify session matches assessmentId from request (skip in dev mode)
      const isDev = process.env.NODE_ENV !== 'production' && process.env.VERCEL !== '1';
      if (!(isDev && req.headers['x-dev-mode'] === 'true')) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = (req as RequestWithSession).session;
        if (!session || session.assessmentId !== assessmentId) {
          sendError(reply, 403, 'Forbidden', 'Session does not match assessment', req);
          return;
        }
      }

      // Fetch assessment metadata
      const metaRows = await fetchAssessmentMetadata(assessmentId, false);
      const meta = validateAssessmentActive(metaRows);
      if (!meta) {
        if (metaRows.length === 0) {
          sendError(reply, 404, 'AssessmentNotFound', undefined, req);
          return;
        }
        sendError(reply, 410, 'AssessmentFinished', undefined, req);
        return;
      }

      // Stop rules: max MAX_ASSESSMENT_ITEMS items or time elapsed
      const numItems = Number(meta.n ?? 0);
      const durationMinutes = meta.duration_minutes;
      const stopResult = await checkStopRules(
        assessmentId,
        numItems,
        meta.started_at,
        durationMinutes,
      );
      if (stopResult.shouldStop) {
        sendError(reply, 410, stopResult.error, undefined, req);
        return;
      }

      const jobId = meta.job_id;

      // Fetch context from database
      const context = await fetchAssessmentContext(assessmentId);
      const { rows: prevRows } = await query<{
        item_id: string;
        answer: string | null;
        question: string | null;
      }>(
        `select
        item_id,
        response->>'answerText' as answer,
        response->>'questionText' as question
       from item_events
       where assessment_id = $1
       order by t_start desc
       limit 5`,
        [assessmentId],
      );

      // Build history from previous Q&A pairs
      const history = buildQuestionHistory(prevRows, jobId, getQuestionText, 5);

      // Build contexts from database fields
      const { jobContext, applicantContext, candidateName } = buildContexts(context, jobId);

      // Calculate time remaining for time-aware questions
      const timeRemainingSeconds = calculateTimeRemaining(durationMinutes, meta.started_at);
      const timeRemainingMinutes =
        timeRemainingSeconds !== null ? secondsToMinutes(timeRemainingSeconds) : undefined;
      const isFirstQuestion = numItems === 0;

      // Generate question using LLM
      const llmAdapter = opts.llmAdapter;
      if (!llmAdapter) {
        sendError(reply, 500, 'LLMAdapterUnavailable', undefined, req);
        return;
      }

      try {
        const result = await llmAdapter.generateQuestion({
          jobContext,
          applicantContext,
          history,
          ...(difficulty && { difficulty }),
          ...(timeRemainingMinutes !== undefined &&
            timeRemainingMinutes !== null && {
              timeRemaining: timeRemainingMinutes,
            }),
          ...(numItems !== undefined && { itemNumber: numItems + 1 }),
          maxItems: MAX_ASSESSMENT_ITEMS,
          isFirstQuestion,
          ...(candidateName && { candidateName }),
          ...(context.resume_text && { resumeText: context.resume_text }),
        });

        // Log question generated event
        req.log.info(
          {
            event: 'question_generated',
            assessmentId,
            itemId: result.itemId,
            difficulty: result.difficulty,
            isFirstQuestion,
            requestId: req.id,
          },
          'Question generated',
        );

        return {
          ok: true,
          question: result.question,
          itemId: result.itemId,
          difficulty: result.difficulty,
          ...(timeRemainingSeconds !== null && { timeRemaining: Math.ceil(timeRemainingSeconds) }),
          isFirstQuestion,
        };
      } catch (err) {
        // Log detailed error server-side with context
        req.log.error(
          {
            event: 'question_generation_failed',
            assessmentId,
            error:
              err instanceof Error
                ? {
                    name: err.name,
                    message: err.message,
                    stack: err.stack,
                  }
                : err,
            requestId: req.id,
          },
          'Failed to generate question',
        );

        // Return generic error in production, detailed in development
        if (process.env.NODE_ENV === 'production') {
          sendError(reply, 500, 'QuestionGenerationFailed', undefined, req, err);
          return;
        }

        // Development: return more details
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
        sendError(reply, 500, 'QuestionGenerationFailed', errorMessage, req, err);
        return;
      }
    },
  );
};

export { registerAssessments };
