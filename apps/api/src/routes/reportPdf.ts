import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { generateAssessmentPdf } from '../services/reportPdf';
import { validateReportRequest, requireSession } from '../services/auth';
import { query } from '../db';

export async function registerReportPdf(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.get('/pdf', async (req, reply) => {
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
    
    const pdfBytes = await generateAssessmentPdf(assessmentId);
    reply
      .header('content-type', 'application/pdf')
      .header('content-disposition', 'attachment; filename="report.pdf"');
    return reply.send(Buffer.from(pdfBytes));
  });
}
