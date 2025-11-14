/**
 * Environment variables (server-only)
 *
 * Example values:
 * - LOG_LEVEL=info
 * - WEB_BASE_URL=http://localhost:3000
 * - DATABASE_URL=postgres://user:pass@host:5432/dbname
 * - JWT_SECRET=replace-with-a-strong-secret
 * - PII_ENCRYPTION_KEY=base64-encoded-32-bytes
 * - POSTMARK_TOKEN= (optional)
 * - POSTMARK_FROM=no-reply@example.com (optional)
 * - LLM_API_KEY=sk-...
 * - LLM_BASE_URL=https://api.openai.com
 * - LLM_MODEL_PRIMARY=gpt-4o-mini
 * - LLM_MODEL_FALLBACK= (optional)
 * - LLM_TIMEOUT_MS=12000
 * - LLM_CACHE_ENABLED=0
 * - LLM_CACHE_TTL_MS=86400000
 */

// Load .env file if it exists (only in non-production environments or when not on Vercel)
import { config } from 'dotenv';

// Only load .env in local development (not on Vercel or in production)
if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production') {
  config();
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  JWT_SECRET: process.env.JWT_SECRET ?? '',
  PII_ENCRYPTION_KEY: process.env.PII_ENCRYPTION_KEY ?? '',
  POSTMARK_TOKEN: process.env.POSTMARK_TOKEN ?? '',
  POSTMARK_FROM: process.env.POSTMARK_FROM ?? '',
  WEB_BASE_URL: process.env.WEB_BASE_URL ?? '',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? '',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  // LLM configuration (server-only)
  LLM_API_KEY: process.env.LLM_API_KEY ?? '',
  LLM_BASE_URL: process.env.LLM_BASE_URL ?? '',
  LLM_MODEL_PRIMARY: process.env.LLM_MODEL_PRIMARY ?? '',
  LLM_MODEL_FALLBACK: process.env.LLM_MODEL_FALLBACK ?? '',
  LLM_TIMEOUT_MS: process.env.LLM_TIMEOUT_MS ?? '12000',
  // Optional LLM in-memory cache
  LLM_CACHE_ENABLED: process.env.LLM_CACHE_ENABLED ?? '0',
  LLM_CACHE_TTL_MS: process.env.LLM_CACHE_TTL_MS ?? '86400000'
};

export function validateEnv(): void {
  if (process.env.NODE_ENV === 'production') {
    const missing: string[] = [];
    if (!env.DATABASE_URL) missing.push('DATABASE_URL');
    if (!env.JWT_SECRET || env.JWT_SECRET.length < 16) missing.push('JWT_SECRET(≥16 chars)');
    if (!env.WEB_BASE_URL) missing.push('WEB_BASE_URL');
    if (missing.length > 0) {
      throw new Error(`Missing required environment vars: ${missing.join(', ')}`);
    }
  }
}


