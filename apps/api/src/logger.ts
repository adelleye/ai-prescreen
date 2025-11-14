import pino from 'pino';

import { env } from './env';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: null,
  redact: {
    paths: ['req.headers.authorization', 'req.body.token', 'req.body.sessionToken'],
    remove: true,
  },
  // Include request ID in logs (Fastify automatically adds req.id)
  serializers: {
    req: (req) => {
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        remoteAddress: req.ip,
      };
    },
  },
  ...(process.env.NODE_ENV !== 'production' ? { transport: { target: 'pino-pretty' } } : {}),
});
