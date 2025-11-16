import { MAX_ASSESSMENT_ITEMS, DEFAULT_ASSESSMENT_DURATION_MINUTES } from '@shared/core';

import { query } from '../db';

import type { AssessmentContext } from './contextBuilder';

export type StopRuleResult =
  | { shouldStop: false }
  | { shouldStop: true; reason: 'MAX_ITEMS' | 'TIME'; error: 'MaxItemsReached' | 'TimeExpired' };

// Re-export for local use
const MAX_ITEMS = MAX_ASSESSMENT_ITEMS;
const DEFAULT_DURATION_MINUTES = DEFAULT_ASSESSMENT_DURATION_MINUTES;

/**
 * Fetches the assessment duration in minutes (configurable, defaults to 15).
 *
 * @param assessmentId - The assessment ID
 * @returns Duration in minutes
 */
export async function getAssessmentDuration(assessmentId: string): Promise<number> {
  try {
    const { rows } = await query<{ duration_minutes: number | null }>(
      'select duration_minutes from assessments where id = $1',
      [assessmentId],
    );
    return rows[0]?.duration_minutes ?? DEFAULT_DURATION_MINUTES;
  } catch {
    // If column doesn't exist yet or query fails, return default
    return DEFAULT_DURATION_MINUTES;
  }
}

/**
 * Calculates time remaining for an assessment.
 *
 * @param durationMinutes - Total duration in minutes
 * @param startedAt - ISO timestamp when assessment started (null if not started)
 * @returns Time remaining in seconds, or null if assessment hasn't started
 */
export function calculateTimeRemaining(
  durationMinutes: number,
  startedAt: string | null,
): number | null {
  if (!startedAt) {
    return null;
  }

  const startedAtMs = Date.parse(startedAt);
  if (!Number.isFinite(startedAtMs)) {
    return null;
  }

  const durationMs = durationMinutes * 60 * 1000;
  const elapsedMs = Date.now() - startedAtMs;
  const remainingMs = durationMs - elapsedMs;

  // Return at least 0, never negative
  return Math.max(0, remainingMs / 1000);
}

/**
 * Converts seconds to minutes, rounded up
 */
export function secondsToMinutes(seconds: number): number {
  return Math.ceil(seconds / 60);
}

/**
 * Checks if assessment should stop based on stop rules (MAX_ITEMS or TIME).
 * If stop condition is met, updates the assessment's finished_at and stop_reason.
 *
 * @param assessmentId - The assessment ID to check
 * @param numItems - Current number of items completed
 * @param startedAt - ISO timestamp when assessment started (null if not started)
 * @param durationMinutes - Assessment duration in minutes (defaults to 15)
 * @returns StopRuleResult indicating whether to stop and the reason
 */
export async function checkStopRules(
  assessmentId: string,
  numItems: number,
  startedAt: string | null,
  durationMinutes: number = DEFAULT_DURATION_MINUTES,
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
    const durationMs = durationMinutes * 60 * 1000;
    const startedAtMs = Date.parse(startedAt);
    if (Number.isFinite(startedAtMs)) {
      const elapsedMs = Date.now() - startedAtMs;
      if (elapsedMs > durationMs) {
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
 * Fetches assessment context fields (job description, company bio, recruiter notes, resume text, application answers, candidate name, duration).
 * Gracefully handles missing columns if migration hasn't been run yet.
 *
 * @param assessmentId - The assessment ID to fetch context for
 * @returns AssessmentContext object with context fields (empty object if columns don't exist)
 */
export async function fetchAssessmentContext(assessmentId: string): Promise<AssessmentContext> {
  try {
    const { rows: contextRows } = await query<AssessmentContext>(
      `select job_description, company_bio, recruiter_notes, resume_text, application_answers, candidate_name, duration_minutes
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
  duration_minutes: number;
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
        returning started_at, finished_at, job_id, duration_minutes
      )
      select
        up.started_at,
        up.finished_at,
        up.job_id,
        coalesce(up.duration_minutes, $2::int) as duration_minutes,
        (select count(1)::int from item_events where assessment_id = $1) as n
      from up
      `,
      [assessmentId, DEFAULT_DURATION_MINUTES],
    );
    return rows;
  } else {
    const { rows } = await query<AssessmentMetadata>(
      `
      select
        started_at,
        finished_at,
        job_id,
        coalesce(duration_minutes, $2::int) as duration_minutes,
        (select count(1)::int from item_events where assessment_id = $1) as n
      from assessments
      where id = $1
      `,
      [assessmentId, DEFAULT_DURATION_MINUTES],
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

/**
 * Calculates time progress as a percentage (0-100).
 * Used for silent time-aware adaptive adjustments.
 *
 * @param durationMinutes - Total assessment duration in minutes
 * @param startedAt - ISO timestamp when assessment started (null if not started)
 * @returns Percentage of time used (0-100), or null if not started
 */
export function calculateTimeProgressPercent(
  durationMinutes: number,
  startedAt: string | null,
): number | null {
  if (!startedAt) {
    return null;
  }

  const startedAtMs = Date.parse(startedAt);
  if (!Number.isFinite(startedAtMs)) {
    return null;
  }

  const durationMs = durationMinutes * 60 * 1000;
  const elapsedMs = Date.now() - startedAtMs;
  const progressPercent = (elapsedMs / durationMs) * 100;

  // Return 0-100 clamped
  return Math.max(0, Math.min(100, progressPercent));
}

/**
 * Determines silent time-aware strategy for topic focus.
 * Returns guidance on which competencies to prioritize INTERNALLY (not visible to candidate).
 *
 * @param timeProgressPercent - Percentage of time used (0-100)
 * @param numItemsCompleted - Number of questions asked so far
 * @returns Object with silent guidance on what to focus on next
 */
export function getTimeAwareFocusStrategy(
  timeProgressPercent: number | null,
  _numItemsCompleted: number,
): {
  shouldProbeDeeper: boolean;
  shouldSlowDown: boolean;
  shouldFocusOnCritical: boolean;
  rationale: string;
} {
  // No time constraint—explore freely
  if (timeProgressPercent === null || timeProgressPercent < 25) {
    return {
      shouldProbeDeeper: true,
      shouldSlowDown: false,
      shouldFocusOnCritical: false,
      rationale: 'Early in assessment. Explore widely and probe deep.',
    };
  }

  // Mid-assessment—balanced approach
  if (timeProgressPercent < 60) {
    return {
      shouldProbeDeeper: true,
      shouldSlowDown: false,
      shouldFocusOnCritical: false,
      rationale: 'Mid-assessment. Continue deep probing while still balanced.',
    };
  }

  // Late but still time—focus on critical gaps
  if (timeProgressPercent < 80) {
    return {
      shouldProbeDeeper: false,
      shouldSlowDown: true,
      shouldFocusOnCritical: true,
      rationale: 'Running low on time. Focus on critical untested competencies.',
    };
  }

  // Very late—only critical remaining gaps
  return {
    shouldProbeDeeper: false,
    shouldSlowDown: true,
    shouldFocusOnCritical: true,
    rationale: 'Very limited time. Ask only the most critical remaining questions.',
  };
}

/**
 * Determines suggested difficulty level based on time remaining.
 * INTERNAL GUIDANCE ONLY (not visible to candidate).
 *
 * @param timeRemainingMinutes - Minutes remaining
 * @returns Suggested difficulty: 'easy' for quick answers, 'hard' for deep probes
 */
export function getTimeAwareDifficultySuggestion(
  timeRemainingMinutes: number | null,
): 'easy' | 'medium' | 'hard' {
  if (timeRemainingMinutes === null) {
    return 'medium';
  }

  if (timeRemainingMinutes > 5) {
    return 'hard'; // Plenty of time for complex questions
  }

  if (timeRemainingMinutes > 2) {
    return 'medium'; // Limited time, moderate complexity
  }

  return 'easy'; // Very limited time, focus on key areas
}
