import { query } from '../db';

import type { AssessmentContext } from './contextBuilder';

export type StopRuleResult =
  | { shouldStop: false }
  | { shouldStop: true; reason: 'MAX_ITEMS' | 'TIME'; error: 'MaxItemsReached' | 'TimeExpired' };

const MAX_ITEMS = 18;
const MAX_TIME_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Checks if assessment should stop based on stop rules (MAX_ITEMS or TIME).
 * If stop condition is met, updates the assessment's finished_at and stop_reason.
 *
 * @param assessmentId - The assessment ID to check
 * @param numItems - Current number of items completed
 * @param startedAt - ISO timestamp when assessment started (null if not started)
 * @returns StopRuleResult indicating whether to stop and the reason
 */
export async function checkStopRules(
  assessmentId: string,
  numItems: number,
  startedAt: string | null,
): Promise<StopRuleResult> {
  // Check MAX_ITEMS rule
  if (Number.isFinite(numItems) && numItems >= MAX_ITEMS) {
    await query(
      'update assessments set finished_at = now(), stop_reason = $2 where id = $1 and finished_at is null',
      [assessmentId, 'MAX_ITEMS'],
    );
    // Revoke any active sessions for this assessment
    await query(
      'update sessions set revoked_at = now() where assessment_id = $1 and revoked_at is null',
      [assessmentId],
    );
    return { shouldStop: true, reason: 'MAX_ITEMS', error: 'MaxItemsReached' };
  }

  // Check TIME rule
  if (startedAt) {
    const startedAtMs = Date.parse(startedAt);
    if (Number.isFinite(startedAtMs)) {
      const elapsedMs = Date.now() - startedAtMs;
      if (elapsedMs > MAX_TIME_MS) {
        await query(
          'update assessments set finished_at = now(), stop_reason = $2 where id = $1 and finished_at is null',
          [assessmentId, 'TIME'],
        );
        // Revoke any active sessions for this assessment
        await query(
          'update sessions set revoked_at = now() where assessment_id = $1 and revoked_at is null',
          [assessmentId],
        );
        return { shouldStop: true, reason: 'TIME', error: 'TimeExpired' };
      }
    }
  }

  return { shouldStop: false };
}

/**
 * Fetches assessment context fields (job description, company bio, recruiter notes, resume text, application answers).
 * Gracefully handles missing columns if migration hasn't been run yet.
 *
 * @param assessmentId - The assessment ID to fetch context for
 * @returns AssessmentContext object with context fields (empty object if columns don't exist)
 */
export async function fetchAssessmentContext(assessmentId: string): Promise<AssessmentContext> {
  try {
    const { rows: contextRows } = await query<AssessmentContext>(
      `select job_description, company_bio, recruiter_notes, resume_text, application_answers
       from assessments where id = $1`,
      [assessmentId],
    );
    return contextRows[0] ?? {};
  } catch {
    // Columns don't exist yet - use fallback context
    return {};
  }
}

export type AssessmentMetadata = {
  started_at: string | null;
  finished_at: string | null;
  job_id: string;
  n: number;
};

/**
 * Fetches assessment metadata including started_at, finished_at, job_id, and item count.
 * Optionally updates started_at if it's null (for first submit).
 *
 * @param assessmentId - The assessment ID to fetch metadata for
 * @param updateStartedAt - If true, updates started_at to now() if it's null
 * @returns Promise resolving to AssessmentMetadata array
 */
export async function fetchAssessmentMetadata(
  assessmentId: string,
  updateStartedAt = false,
): Promise<AssessmentMetadata[]> {
  if (updateStartedAt) {
    const { rows } = await query<AssessmentMetadata>(
      `
      with up as (
        update assessments
        set started_at = coalesce(started_at, now())
        where id = $1
        returning started_at, finished_at, job_id
      )
      select 
        up.started_at, 
        up.finished_at,
        up.job_id,
        (select count(1)::int from item_events where assessment_id = $1) as n
      from up
      `,
      [assessmentId],
    );
    return rows;
  } else {
    const { rows } = await query<AssessmentMetadata>(
      `
      select 
        started_at, 
        finished_at,
        job_id,
        (select count(1)::int from item_events where assessment_id = $1) as n
      from assessments
      where id = $1
      `,
      [assessmentId],
    );
    return rows;
  }
}

/**
 * Validates that an assessment exists and is active (not finished).
 * This is a state validation check - ensures the assessment can still accept submissions.
 *
 * @param metaRows - Query result rows containing assessment metadata
 * @returns AssessmentMetadata if valid and active, null if not found or already finished
 */
export function validateAssessmentActive(
  metaRows: AssessmentMetadata[],
): AssessmentMetadata | null {
  if (metaRows.length === 0) {
    return null;
  }
  const meta = metaRows[0];
  if (!meta) {
    return null;
  }
  if (meta.finished_at) {
    return null;
  }
  return meta;
}

export type QuestionHistoryItem = {
  question: string;
  answer: string;
};

/**
 * Builds question history from previous item events.
 *
 * @param prevRows - Query result rows from item_events table
 * @param jobId - Job ID for fallback question text
 * @param getQuestionText - Function to get question text by jobId and itemId
 * @param limit - Maximum number of history items to return
 * @returns Array of question-answer pairs, ordered chronologically
 */
export function buildQuestionHistory(
  prevRows: Array<{ item_id: string; answer: string | null; question: string | null }>,
  jobId: string,
  getQuestionText: (jobId: string, itemId: string) => string | undefined,
  limit: number,
): QuestionHistoryItem[] {
  const history: QuestionHistoryItem[] = [];
  for (const r of prevRows.slice(0, limit).reverse()) {
    const question = r.question ?? getQuestionText(jobId, r.item_id) ?? `Item ${r.item_id}`;
    if (r.answer) {
      history.push({ question, answer: r.answer });
    }
  }
  return history;
}
