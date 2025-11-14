import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { createHash, randomBytes } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { query, withTransaction } from '../db';
import { env } from '../env';
import {
  IssueMagicLinkRequest,
  ConsumeMagicLinkRequest,
  importAesGcmKey,
  encryptPII,
  fetchWithTimeout,
} from '@shared/core';
import { sendError } from '../services/errors';
import { createSessionToken } from '../services/auth';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function logAudit(
  action: string,
  entity: string,
  entityId: string,
  ip: string,
  ua: string,
): Promise<void> {
  await query(
    `insert into audit_logs (actor, action, entity, entity_id, ip, ua)
     values ($1, $2, $3, $4, $5, $6)`,
    ['system', action, entity, entityId, ip, ua],
  );
}

export async function registerMagic(app: FastifyInstance, _opts: FastifyPluginOptions) {
  app.post('/issue', async (req, reply) => {
    const parsed = IssueMagicLinkRequest.safeParse(req.body);
    if (!parsed.success) {
      sendError(reply, 400, 'BadRequest', undefined, req);
      return;
    }
    if (!env.JWT_SECRET || !env.PII_ENCRYPTION_KEY) {
      sendError(reply, 500, 'ServerConfig', undefined, req);
      return;
    }
    const { email, jobId } = parsed.data;
    const nonce = randomBytes(16).toString('hex');
    const token = await new SignJWT({ email, jobId, n: nonce })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(new TextEncoder().encode(env.JWT_SECRET));
    const tokenHash = hashToken(token);

    // Encrypt PII (email) before persisting
    const aesKey = await importAesGcmKey(env.PII_ENCRYPTION_KEY);
    const emailEnc = await encryptPII(aesKey, email);

    await query(
      `insert into magic_links (email_enc, token_hash, nonce, expires_at, consumed_at, ip, ua)
       values ($1, $2, $3, now() + interval '24 hours', null, $4, $5)`,
      [emailEnc, tokenHash, nonce, req.ip, req.headers['user-agent'] ?? ''],
    );

    // Audit log
    await logAudit('magic.issue', 'magic_link', tokenHash, req.ip, req.headers['user-agent'] ?? '');

    // Attempt to send transactional email via Postmark (best-effort)
    if (env.POSTMARK_TOKEN && env.POSTMARK_FROM && env.WEB_BASE_URL) {
      const linkUrl = `${env.WEB_BASE_URL}/assessment?token=${encodeURIComponent(token)}`;
      try {
        const res = await fetchWithTimeout('https://api.postmarkapp.com/email', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Postmark-Server-Token': env.POSTMARK_TOKEN,
          },
          body: JSON.stringify({
            From: env.POSTMARK_FROM,
            To: email,
            Subject: 'Your Juno Quick Screen assessment link',
            TextBody: `Your secure assessment link (valid 24h): ${linkUrl}`,
            MessageStream: 'outbound',
          }),
          timeoutMs: 10_000,
        });
        if (!res.ok) {
          await logAudit('postmark.send.failed', 'magic_link', tokenHash, req.ip, req.headers['user-agent'] ?? '');
        }
      } catch {
        await logAudit('postmark.send.error', 'magic_link', tokenHash, req.ip, req.headers['user-agent'] ?? '');
      }
    }

    // Do not return token here; it will be sent via transactional email
    return { ok: true, magicLinkId: tokenHash, email };
  });

  app.post('/consume', async (req, reply) => {
    const parsed = ConsumeMagicLinkRequest.safeParse(req.body);
    if (!parsed.success) {
      sendError(reply, 400, 'BadRequest', undefined, req);
      return;
    }
    if (!env.JWT_SECRET) {
      sendError(reply, 500, 'ServerConfig', undefined, req);
      return;
    }

    const token = parsed.data.token;
    const tokenHash = hashToken(token);

    const { rows } = await query<{ consumed_at: string | null; expires_at: string; nonce: string }>(
      'select consumed_at, expires_at, nonce from magic_links where token_hash = $1',
      [tokenHash],
    );
    if (rows.length === 0) {
      sendError(reply, 410, 'Gone', undefined, req);
      return;
    }
    const row0 = rows[0];
    if (row0?.consumed_at) {
      sendError(reply, 410, 'Gone', undefined, req);
      return;
    }
    const now = Date.now();
    const exp = row0?.expires_at ? Date.parse(row0.expires_at) : NaN;
    if (Number.isFinite(exp) && now > exp) {
      sendError(reply, 410, 'Gone', undefined, req);
      return;
    }

    let jobId: string | undefined;
    let nonce: string | undefined;
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(env.JWT_SECRET));
      jobId = typeof payload.jobId === 'string' ? payload.jobId : undefined;
      nonce = typeof payload.n === 'string' ? payload.n : undefined;
    } catch (err) {
      sendError(reply, 410, 'Gone', undefined, req, err);
      return;
    }
    if (!jobId || !nonce) {
      sendError(reply, 410, 'Gone', undefined, req);
      return;
    }
    if (nonce !== row0?.nonce) {
      sendError(reply, 410, 'Gone', undefined, req);
      return;
    }

    // Use transaction to ensure atomicity: mark consumed, create assessment, create session
    let assessmentId: string;
    let sessionId: string;
    try {
      const result = await withTransaction(async (client) => {
        // Mark consumed (single-use)
        await client.query('update magic_links set consumed_at = now() where token_hash = $1', [tokenHash]);

        // Create assessment row
        const { rows: aRows } = await client.query<{ id: string }>(
          `insert into assessments (job_id, candidate_id, created_at)
           values ($1, gen_random_uuid(), now()) returning id`,
          [jobId],
        );
        const inserted = aRows[0];
        if (!inserted) {
          throw new Error('Failed to create assessment');
        }
        const assessmentId = inserted.id;

        // Create session
        const { rows: sRows } = await client.query<{ id: string }>(
          `insert into sessions (assessment_id, expires_at, ip, ua)
           values ($1, now() + interval '2 hours', $2, $3)
           returning id`,
          [assessmentId, req.ip, req.headers['user-agent'] ?? ''],
        );
        const session = sRows[0];
        if (!session) {
          throw new Error('Failed to create session');
        }

        return { assessmentId, sessionId: session.id };
      });
      assessmentId = result.assessmentId;
      sessionId = result.sessionId;
    } catch (err) {
      req.log.error({
        event: 'magic_link_consume_failed',
        tokenHash,
        error: err instanceof Error ? {
          name: err.name,
          message: err.message,
          stack: err.stack,
        } : err,
        requestId: req.id,
      }, 'Failed to consume magic link');
      sendError(reply, 500, 'CreateAssessmentFailed', undefined, req, err);
      return;
    }

    // Audit log
    await logAudit('magic.consume', 'assessment', assessmentId, req.ip, req.headers['user-agent'] ?? '');

    // Create session token
    const sessionToken = await createSessionToken(assessmentId, sessionId);

    return { ok: true, assessmentId, sessionToken };
  });
}
