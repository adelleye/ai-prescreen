/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Sends a standardized error response and logs error details server-side.
 * Error details are logged but not exposed to clients in production.
 *
 * @param reply - Fastify reply object
 * @param code - HTTP status code
 * @param error - Error code string (e.g., 'BadRequest', 'NotFound')
 * @param message - Optional error message (for development/debugging)
 * @param req - Optional request object for logging context
 * @param err - Optional error object for detailed logging
 */
export function sendError(
  reply: FastifyReply,
  code: number,
  error: string,
  message?: string,
  req?: FastifyRequest,
  err?: unknown,
): void {
  // Log error details server-side with request context
  const logContext: Record<string, unknown> = {
    errorCode: error,
    statusCode: code,
    requestId: req?.id,
    assessmentId: (req as any)?.session?.assessmentId,
  };

  if (err instanceof Error) {
    logContext.error = {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  } else if (err) {
    logContext.error = err;
  }

  if (message) {
    logContext.userMessage = message;
  }

  // Use appropriate log level based on status code
  if (code >= 500) {
    req?.log?.error(logContext, `Server error: ${error}`);
  } else if (code >= 400) {
    req?.log?.warn(logContext, `Client error: ${error}`);
  } else {
    req?.log?.info(logContext, `Response: ${error}`);
  }

  const payload: { ok: false; error: string; message?: string } = { ok: false, error };
  // Only include message in development or for specific error codes
  if (message && (process.env.NODE_ENV !== 'production' || code >= 500)) {
    payload.message = message;
  }
  reply.code(code).send(payload);
}
