import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { query } from '../db';
import { getAssessmentSummary } from '../services/reportSummary';
import { validateReportRequest, requireSession } from '../services/auth';

export async function registerReport(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.get('/csv', async (req, reply) => {
    const session = await requireSession(req, reply);
    if (!session) return;
    const assessmentId = await validateReportRequest(req.query, reply);
    if (!assessmentId) return;
    if (session.assessmentId !== assessmentId) {
      await query(
        `insert into audit_logs (actor, action, entity, entity_id, ip, ua)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          `candidate:${session.sessionId}`,
          'report.access.denied',
          'assessment',
          assessmentId,
          (req as any).ip ?? '',
          req.headers['user-agent'] ?? '',
        ],
      );
      reply.code(403).send({ ok: false, error: 'Forbidden' });
      return;
    }
    await query(
      `insert into audit_logs (actor, action, entity, entity_id, ip, ua)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        `candidate:${session.sessionId}`,
        'report.access',
        'assessment',
        assessmentId,
        (req as any).ip ?? '',
        req.headers['user-agent'] ?? '',
      ],
    );
    const summary = await getAssessmentSummary(assessmentId);

    const rows = [
      ['assessmentId', 'totalScore', 'integrityBand'],
      [assessmentId, String(summary.totalScore), summary.integrity.band],
    ];
    reply
      .header('content-type', 'text/csv')
      .header('content-disposition', 'attachment; filename="report.csv"');
    return rows.map((r) => r.join(',')).join('\n');
  });
}
