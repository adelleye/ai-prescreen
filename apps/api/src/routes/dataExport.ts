import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { query } from '../db';
import { requireSession } from '../services/auth';

export async function registerDataExport(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.get('/data-export', async (req, reply) => {
    const session = await requireSession(req, reply);
    if (!session) return;
    const assessmentId = (req.query as any)?.assessmentId as string | undefined;
    if (!assessmentId) {
      reply.code(400).send({ ok: false, error: 'BadRequest' });
      return;
    }
    if (session.assessmentId !== assessmentId) {
      await query(
        `insert into audit_logs (actor, action, entity, entity_id, ip, ua)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          `candidate:${session.sessionId}`,
          'data.export.denied',
          'assessment',
          assessmentId,
          (req as any).ip ?? '',
          req.headers['user-agent'] ?? '',
        ],
      );
      reply.code(403).send({ ok: false, error: 'Forbidden' });
      return;
    }
    // Fetch assessment
    const { rows: arows } = await query(
      `select id, job_id, created_at, started_at, finished_at, total_score, integrity_band
       from assessments where id = $1`,
      [assessmentId],
    );
    if (arows.length === 0) {
      reply.code(404).send({ ok: false, error: 'NotFound' });
      return;
    }
    // Fetch item events
    const { rows: irows } = await query(
      `select item_id, t_start, t_end, response, score, events
       from item_events
       where assessment_id = $1
       order by t_start asc`,
      [assessmentId],
    );
    await query(
      `insert into audit_logs (actor, action, entity, entity_id, ip, ua)
       values ($1, $2, $3, $4, $5, $6)`,
      [
        `candidate:${session.sessionId}`,
        'data.export',
        'assessment',
        assessmentId,
        (req as any).ip ?? '',
        req.headers['user-agent'] ?? '',
      ],
    );
    reply.send({
      assessment: arows[0],
      items: irows,
    });
  });
}


