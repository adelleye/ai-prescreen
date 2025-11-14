/**
 * Custom error classes for LLM operations
 */

export class LLMConfigurationError extends Error {
  constructor(message = 'LLM configuration missing') {
    super(message);
    this.name = 'LLMConfigurationError';
  }
}

export class LLMHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message?: string,
  ) {
    super(message ?? `LLM HTTP ${status}: ${body.slice(0, 256)}`);
    this.name = 'LLMHttpError';
  }
}

export class LLMResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LLMResponseError';
  }
}

