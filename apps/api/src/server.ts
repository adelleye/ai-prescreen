import Fastify from 'fastify';
import { pathToFileURL } from 'node:url';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { logger } from './logger';
import { registerMagic } from './routes/magic';
import { registerAssessments } from './routes/assessments';
import { registerReport } from './routes/report';
import { registerSignals } from './routes/signals';
import { registerReportPdf } from './routes/reportPdf';
import { registerDev } from './routes/dev';
import { OpenAIAdapter } from './llm/openaiProvider';
import { createScoringService } from './services/scoring';
import { env, validateEnv } from './env';

export async function buildServer() {
  // Fail fast on missing env in production-like environments
  validateEnv();
  const app = Fastify({
    logger,
    bodyLimit: 1048576, // 1MB
  });

  // Security headers
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  });

  // CORS - restrict to WEB_BASE_URL origin
  // Note: Next.js rewrites appear as same-origin (no Origin header), so we allow those
  const isProduction = process.env.NODE_ENV === 'production';
  const allowedDevOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];

  await app.register(cors, {
    origin: (origin, cb) => {
      // Reject requests with no origin in production (prevents file:// and null-origin CSRF vectors)
      if (!origin) {
        if (isProduction) {
          return cb(new Error('CORS: No origin provided'), false);
        }
        // Allow in development for local tools and mobile testing
        return cb(null, true);
      }

      // In production, only allow WEB_BASE_URL
      if (isProduction) {
        const allowlist = [
          env.WEB_BASE_URL,
          ...(env.ALLOWED_ORIGINS || '')
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0),
        ];
        return cb(null, allowlist.includes(origin));
      }

      // In development, allow localhost origins and WEB_BASE_URL
      const isAllowed = allowedDevOrigins.includes(origin) || origin === env.WEB_BASE_URL;
      cb(null, isAllowed);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  });

  // Global rate limiting (can be overridden per route)
  await app.register(rateLimit, {
    max: 100, // 100 requests per window
    timeWindow: '1 minute',
  });

  // Simple JSON content-type guard for state-changing requests
  app.addHook('preValidation', async (req, reply) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      const ct = req.headers['content-type'] || '';
      if (!ct.toLowerCase().includes('application/json')) {
        reply.code(415).send({ ok: false, error: 'UnsupportedMediaType' });
      }
    }
  });

  app.get('/health', async () => ({ ok: true }));

  // LLM health check endpoint
  app.get('/health/llm', async (req, reply) => {
    const checks: Record<string, boolean> = {};
    const errors: string[] = [];

    // Check required env vars
    checks.apiKeyPresent = !!env.LLM_API_KEY;
    checks.modelConfigured = !!env.LLM_MODEL_PRIMARY;
    checks.baseUrlValid = !!env.LLM_BASE_URL || true; // Optional, defaults to OpenAI

    if (!checks.apiKeyPresent) {
      errors.push('LLM_API_KEY is missing');
    }
    if (!checks.modelConfigured) {
      errors.push('LLM_MODEL_PRIMARY is not configured');
    }

    const allHealthy = Object.values(checks).every((v) => v);

    if (!allHealthy) {
      return reply.code(503).send({
        ok: false,
        checks,
        errors,
        message: 'LLM service is not properly configured',
      });
    }

    return {
      ok: true,
      checks,
      message: 'LLM service is configured and ready',
    };
  });

  // Magic link routes with stricter rate limiting (10/hour)
  await app.register(
    async function (fastify) {
      await fastify.register(rateLimit, {
        max: 10,
        timeWindow: '1 hour',
      });
      await fastify.register(registerMagic);
    },
    { prefix: '/magic' },
  );

  // Register dev-only routes only outside production
  if (!isProduction) {
    app.register(registerDev, { prefix: '/dev' });
  }
  // Instantiate LLM adapter and scoring service (server-only)
  const llmAdapter = new OpenAIAdapter();
  const scoringService = createScoringService(llmAdapter);

  // Assessment routes (per-assessment rate limiting handled in registerAssessments)
  try {
    await app.register(registerAssessments, {
      prefix: '/assessments',
      scoringService,
      llmAdapter,
    });
    logger.info('Assessment routes registered successfully');
  } catch (err) {
    logger.error({ err }, 'Failed to register assessment routes');
    throw err;
  }

  // Report routes with rate limiting (20/hour)
  await app.register(
    async function (fastify) {
      await fastify.register(rateLimit, {
        max: 20,
        timeWindow: '1 hour',
      });
      await fastify.register(registerReport);
      await fastify.register(registerReportPdf);
    },
    { prefix: '/report' },
  );

  // Data export route (GDPR)
  const { registerDataExport } = await import('./routes/dataExport');
  await app.register(registerDataExport);

  // Signals endpoint at root /signals (no /api prefix for consistency)
  app.register(registerSignals);
  return app;
}

// Local dev only (ESM-friendly main check)
const isMainModule = import.meta.url === pathToFileURL(process.argv[1] || '').href;
if (process.env.VERCEL !== '1' && isMainModule) {
  buildServer()
    .then(async (app) => {
      await app.ready();
      return app.listen({ port: Number(process.env.PORT ?? 4000), host: '0.0.0.0' });
    })
    .then((addr) => {
      logger.info(`API listening at ${addr}`);
    })
    .catch((err) => {
      logger.error(err, 'Failed to start server');
      process.exit(1);
    });
}
