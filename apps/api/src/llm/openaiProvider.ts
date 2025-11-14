import { buildBarsPrompt, parseBarsFromModelText, buildQuestionPrompt, parseQuestionFromModelText } from './barsPrompt';
import type { LlmAdapter } from './adapter';
import { env } from '../env';
import { z } from 'zod';
import { createHash } from 'crypto';
import { LLMConfigurationError, LLMHttpError, LLMResponseError } from './errors';

type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string };

async function callChatCompletions(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  timeoutMs: number;
  seed?: number;
}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const body: Record<string, unknown> = {
      model: opts.model,
      messages: opts.messages,
      temperature: 0,
      top_p: 1,
      // Some providers support a deterministic seed; ignore if unsupported
      seed: opts.seed,
      // If supported, this nudges JSON outputs; ignored otherwise.
      response_format: { type: 'json_object' },
    };
    // Use max_completion_tokens for newer models, max_tokens for older ones
    if (opts.model.includes('gpt-4o') || opts.model.includes('o1')) {
      body.max_completion_tokens = 256;
    } else {
      body.max_tokens = 256;
    }
    const res = await fetch(`${opts.baseUrl.replace(/\/+$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new LLMHttpError(res.status, body);
    }
    const raw = await res.json();
    const ChoiceSchema = z.object({
      message: z.object({ content: z.string().optional() }).optional(),
      delta: z.object({ content: z.string().optional() }).optional(),
    });
    const ResponseSchema = z.object({
      choices: z.array(ChoiceSchema).nonempty(),
    });
    const parsed = ResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new LLMResponseError('LLM response schema mismatch');
    }
    const first = parsed.data.choices[0];
    const content = first.message?.content ?? first.delta?.content;
    if (!content || typeof content !== 'string') {
      throw new LLMResponseError('LLM returned no content');
    }
    return content;
  } finally {
    clearTimeout(t);
  }
}

export class OpenAIAdapter implements LlmAdapter {
  async gradeAnswer(input: {
    itemId: string;
    prompt: string;
    answer: string;
    seed: number;
    timeoutMs?: number;
    jobContext?: string;
    applicantContext?: string;
    history?: Array<{ question: string; answer: string }>;
  }) {
    if (!env.LLM_API_KEY || !env.LLM_MODEL_PRIMARY) {
      throw new LLMConfigurationError();
    }
    const timeoutMs = input.timeoutMs ?? Number(env.LLM_TIMEOUT_MS ?? 12000);
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'You are a strict interviewer scoring using BARS. Only output the required JSON object and nothing else.',
      },
      {
        role: 'user',
        content: buildBarsPrompt({
          itemId: input.itemId,
          question: input.prompt,
          answer: input.answer,
          ...(input.jobContext && { jobContext: input.jobContext }),
          ...(input.applicantContext && { applicantContext: input.applicantContext }),
          ...(input.history && { history: input.history }),
        }),
      },
    ];
    const primaryModel = env.LLM_MODEL_PRIMARY;
    const baseUrl = env.LLM_BASE_URL || 'https://api.openai.com';
    // Optional in-memory cache
    const cacheEnabled = (env.LLM_CACHE_ENABLED ?? '0') === '1';
    const ttlMs = Number(env.LLM_CACHE_TTL_MS ?? 86_400_000);
    const answerHash = createHash('sha1').update(input.answer).digest('hex');
    const contextKey = `${input.prompt}|${input.jobContext ?? ''}|${input.applicantContext ?? ''}`;
    const contextHash = createHash('sha1').update(contextKey).digest('hex');
    const cacheKeyBase = `${input.itemId}|${primaryModel}|${input.seed}|${answerHash}|${contextHash}`;
    const cached = cacheEnabled ? getFromCache(cacheKeyBase) : undefined;
    if (cached) return cached;
    try {
      const text = await callChatCompletions({
        baseUrl,
        apiKey: env.LLM_API_KEY,
        model: primaryModel,
        messages,
        timeoutMs,
        seed: input.seed,
      });
      const parsed = parseBarsFromModelText(text);
      if (cacheEnabled) setInCache(cacheKeyBase, parsed, ttlMs);
      return parsed;
    } catch (err) {
      if (!env.LLM_MODEL_FALLBACK) throw err;
      const text = await callChatCompletions({
        baseUrl,
        apiKey: env.LLM_API_KEY,
        model: env.LLM_MODEL_FALLBACK,
        messages,
        timeoutMs,
        seed: input.seed + 1000,
      });
      const parsed = parseBarsFromModelText(text);
      if (cacheEnabled) {
        const fbKey = cacheKeyBase.replace(`|${primaryModel}|`, `|${env.LLM_MODEL_FALLBACK}|`);
        setInCache(fbKey, parsed, ttlMs);
      }
      return parsed;
    }
  }

  async generateQuestion(input: {
    jobContext: string;
    applicantContext: string;
    history: Array<{ question: string; answer: string }>;
    difficulty?: 'easy' | 'medium' | 'hard';
    timeoutMs?: number;
  }): Promise<{
    question: string;
    itemId: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }> {
    if (!env.LLM_API_KEY || !env.LLM_MODEL_PRIMARY) {
      throw new LLMConfigurationError();
    }
    const timeoutMs = input.timeoutMs ?? Number(env.LLM_TIMEOUT_MS ?? 12000);
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'You are a tough interviewer generating contextual interview questions. Only output the required JSON object and nothing else.',
      },
      {
        role: 'user',
        content: buildQuestionPrompt({
          jobContext: input.jobContext,
          applicantContext: input.applicantContext,
          history: input.history,
          ...(input.difficulty && { difficulty: input.difficulty }),
        }),
      },
    ];
    const baseUrl = env.LLM_BASE_URL || 'https://api.openai.com';
    
    async function generateWithModel(model: string, seed: number) {
      const text = await callChatCompletions({
        baseUrl,
        apiKey: env.LLM_API_KEY,
        model,
        messages,
        timeoutMs,
        seed,
      });
      const parsed = parseQuestionFromModelText(text);
      const itemId = `q_${createHash('sha1')
        .update(parsed.question + Date.now().toString())
        .digest('hex')
        .slice(0, 8)}`;
      return {
        question: parsed.question,
        itemId,
        difficulty: parsed.difficulty,
      };
    }
    
    try {
      const randomSeed = Math.floor(Math.random() * 1000000);
      return await generateWithModel(env.LLM_MODEL_PRIMARY, randomSeed);
    } catch (err) {
      if (!env.LLM_MODEL_FALLBACK) throw err;
      const randomSeed = Math.floor(Math.random() * 1000000);
      return await generateWithModel(env.LLM_MODEL_FALLBACK, randomSeed);
    }
  }
}

/**
 * In-memory cache for LLM grading responses to reduce API costs during retries.
 * 
 * Cache behavior:
 * - Enabled via LLM_CACHE_ENABLED environment variable (default: disabled)
 * - TTL configured via LLM_CACHE_TTL_MS (default: 24 hours)
 * - Cache key: `${itemId}|${model}|${seed}|${answerHash}`
 * - Automatic cleanup: expired entries removed when cache size exceeds 1000 entries
 * - Thread-safe: Node.js single-threaded event loop ensures no race conditions
 * 
 * Memory considerations:
 * - Each entry stores a small JSON object (~100-200 bytes)
 * - At 1000 entries: ~100-200 KB memory usage
 * - Cleanup runs synchronously when threshold exceeded (minimal performance impact)
 * - Cache is module-scoped singleton, shared across all requests
 * 
 * Use cases:
 * - Prevents duplicate LLM calls during retry storms (partial failures)
 * - Reduces costs for identical answers to same questions
 * - Improves response time for cached hits
 */
type CachedValue = {
  value: { criteria: { policyProcedure: 0 | 1 | 2 | 3; decisionQuality: 0 | 1 | 2 | 3; evidenceSpecificity: 0 | 1 | 2 | 3 }; followUp?: string };
  expires: number;
};
const cache = new Map<string, CachedValue>();

/**
 * Retrieves a value from the cache if it exists and hasn't expired.
 * Automatically removes expired entries on access.
 * 
 * @param key - Cache key (format: `${itemId}|${model}|${seed}|${answerHash}`)
 * @returns Cached value if found and valid, undefined otherwise
 */
function getFromCache(key: string) {
  const now = Date.now();
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < now) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

/**
 * Stores a value in the cache with TTL expiration.
 * Performs automatic cleanup of expired entries when cache size exceeds 1000.
 * 
 * @param key - Cache key
 * @param value - Value to cache (BARS criteria result)
 * @param ttlMs - Time-to-live in milliseconds
 */
function setInCache(key: string, value: CachedValue['value'], ttlMs: number) {
  const now = Date.now();
  cache.set(key, { value, expires: now + ttlMs });
  // Simple cleanup: remove expired entries when cache gets large
  // This prevents unbounded memory growth while keeping cleanup overhead low
  if (cache.size > 1000) {
    for (const [k, v] of cache.entries()) {
      if (v.expires < now) cache.delete(k);
    }
  }
}


