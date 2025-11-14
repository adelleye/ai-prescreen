import { query } from '../db';
import { computeIntegrityRisk, type IntegrityEvent } from '@shared/core';

export type AssessmentSummary = {
  totalScore: number; // 0-100
  integrity: ReturnType<typeof computeIntegrityRisk>;
};

export async function getAssessmentSummary(assessmentId: string): Promise<AssessmentSummary> {
  // Compute total score as average of per-item totals (0-9) and scale to 0-100
  const { rows: scoreRows } = await query<{ avg_total: string }>(
    `select coalesce(avg((item_events.score->>'total')::numeric), 0) as avg_total
     from item_events where assessment_id = $1`,
    [assessmentId],
  );
  const avgTotal = Number(scoreRows[0]?.avg_total ?? 0);
  const totalScore = Math.round((avgTotal / 9) * 100);

  // Gather integrity events for risk
  const { rows: eventRows } = await query<{ events: IntegrityEvent[] | null }>(
    `select events from item_events where assessment_id = $1`,
    [assessmentId],
  );
  const allEvents: IntegrityEvent[] = [];
  for (const r of eventRows) {
    const arr = Array.isArray(r.events) ? r.events : [];
    for (const e of arr) allEvents.push(e);
  }
  const integrity = computeIntegrityRisk(allEvents);

  return { totalScore, integrity };
}



