import { IntegrityEventSchema } from '@shared/core';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';

import { sendError } from '../services/errors';

export async function registerSignals(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.post('/signals', async (req, reply) => {
    let raw: unknown = req.body as unknown;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = {};
      }
    }
    const parsed = IntegrityEventSchema.safeParse(raw);
    if (!parsed.success) {
      sendError(reply, 400, 'BadRequest', undefined, req);
      return;
    }
    const payload = parsed.data;
    // Log structured signal (no PII)
    req.log.info(
      {
        signalType: payload.type,
        at: payload.at,
        itemId: payload.itemId,
        meta: payload.meta,
        ip: req.ip,
        ua: req.headers['user-agent'] ?? '',
      },
      'signal.received',
    );
    // 204 No Content for beacons
    return reply.code(204).send();
  });
}
