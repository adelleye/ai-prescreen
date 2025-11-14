import type { FastifyReply, FastifyRequest } from 'fastify';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';

import { query } from '../db';
import { env } from '../env';

/**
 * Session payload structure for JWT tokens
 */
export interface SessionPayload {
  sessionId: string;
  assessmentId: string;
}

/**
 * Creates a session token (JWT) for an assessment.
 * Session tokens are used to authorize access to assessment endpoints.
 *
 * @param assessmentId - The assessment ID to create a session for
 * @param sessionId - The database session ID
 * @returns Promise resolving to the JWT session token
 */
export async function createSessionToken(assessmentId: string, sessionId: string): Promise<string> {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }
  return await new SignJWT({ sessionId, assessmentId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(new TextEncoder().encode(env.JWT_SECRET));
}

/**
 * Validates a session token and returns the session payload.
 *
 * @param token - The JWT session token
 * @returns Promise resolving to SessionPayload if valid, null if invalid
 */
export async function validateSessionToken(token: string): Promise<SessionPayload | null> {
  if (!env.JWT_SECRET) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(env.JWT_SECRET));
    const sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : null;
    const assessmentId = typeof payload.assessmentId === 'string' ? payload.assessmentId : null;
    if (!sessionId || !assessmentId) {
      return null;
    }
    return { sessionId, assessmentId };
  } catch {
    return null;
  }
}

/**
 * Validates that a session exists in the database and is not expired.
 * Also verifies the session belongs to the specified assessment.
 *
 * @param sessionId - The session ID from the token
 * @param assessmentId - The assessment ID from the token
 * @returns Promise resolving to true if session is valid, false otherwise
 */
export async function validateSession(sessionId: string, assessmentId: string): Promise<boolean> {
  const { rows } = await query<{
    expires_at: string;
    assessment_id: string;
    revoked_at: string | null;
  }>(`select expires_at, assessment_id, revoked_at from sessions where id = $1`, [sessionId]);
  if (rows.length === 0) {
    return false;
  }
  const row = rows[0];
  if (!row) {
    return false;
  }
  // Verify session belongs to assessment
  if (row.assessment_id !== assessmentId) {
    return false;
  }
  // Check revocation
  if (row.revoked_at) {
    return false;
  }
  // Check expiration
  const expiresAt = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return false;
  }
  return true;
}

/**
 * Creates a session in the database for an assessment.
 *
 * @param assessmentId - The assessment ID
 * @param ip - Client IP address
 * @param ua - User agent string
 * @returns Promise resolving to the session ID
 */
export async function createSession(assessmentId: string, ip: string, ua: string): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `insert into sessions (assessment_id, expires_at, ip, ua)
     values ($1, now() + interval '24 hours', $2, $3)
     returning id`,
    [assessmentId, ip, ua],
  );
  const session = rows[0];
  if (!session) {
    throw new Error('Failed to create session');
  }
  return session.id;
}

/**
 * Validates that an assessment exists and returns its metadata.
 * This is a basic existence check - use validateSession for authorization.
 *
 * @param assessmentId - The assessment ID to validate
 * @returns Object with exists flag and optional jobId
 */
export async function validateAssessmentAccess(assessmentId: string): Promise<{
  exists: boolean;
  jobId?: string;
}> {
  const { rows } = await query<{ job_id: string }>('select job_id from assessments where id = $1', [
    assessmentId,
  ]);
  if (rows.length === 0) {
    return { exists: false };
  }
  const jobId = rows[0]?.job_id;
  return { exists: true, ...(jobId && { jobId }) };
}

/**
 * Middleware to validate session token from Authorization header.
 * Extracts token, validates it, and attaches session info to request.
 * Supports dev mode via X-Dev-Mode header (bypass session validation).
 *
 * @param req - Fastify request object
 * @param reply - Fastify reply object
 * @returns Promise resolving to SessionPayload if valid, null if invalid (error sent)
 */
export async function requireSession(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<SessionPayload | null> {
  // Dev mode bypass allowed only for true local development (not Vercel/preview)
  const isLocalDev =
    process.env.NODE_ENV === 'development' &&
    process.env.VERCEL !== '1' &&
    !(process.env.DATABASE_URL ?? '').includes('prod');
  if (isLocalDev && req.headers['x-dev-mode'] === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bodyAssessment = (req as any)?.body?.assessmentId;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queryAssessment = (req as any)?.query?.assessmentId;
    const assessmentId =
      typeof bodyAssessment === 'string'
        ? bodyAssessment
        : typeof queryAssessment === 'string'
          ? queryAssessment
          : null;
    if (assessmentId) {
      req.log?.warn({ assessmentId }, 'Dev mode authentication used');
      return { sessionId: 'dev-mode', assessmentId };
    }
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply
      .code(401)
      .send({
        ok: false,
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      });
    return null;
  }
  const token = authHeader.slice(7);
  const sessionPayload = await validateSessionToken(token);
  if (!sessionPayload) {
    reply.code(401).send({ ok: false, error: 'Unauthorized', message: 'Invalid session token' });
    return null;
  }
  const isValid = await validateSession(sessionPayload.sessionId, sessionPayload.assessmentId);
  if (!isValid) {
    reply
      .code(401)
      .send({ ok: false, error: 'Unauthorized', message: 'Session expired or invalid' });
    return null;
  }
  return sessionPayload;
}

const reportReqSchema = z.object({
  assessmentId: z.string().uuid(),
});

/**
 * Validates report request query parameters and assessment access.
 * For reports, we allow access with just assessmentId (for recruiters).
 * Session validation is optional for report endpoints.
 *
 * @param query - Request query parameters (unknown type for validation)
 * @param reply - Fastify reply object for sending error responses
 * @returns Assessment ID if valid, null if validation fails (error already sent)
 */
export async function validateReportRequest(
  query: unknown,
  reply: FastifyReply,
): Promise<string | null> {
  const params = reportReqSchema.safeParse(query);
  if (!params.success) {
    reply.code(400).send('BadRequest');
    return null;
  }
  const access = await validateAssessmentAccess(params.data.assessmentId);
  if (!access.exists) {
    reply.code(403).send('Forbidden');
    return null;
  }
  return params.data.assessmentId;
}
