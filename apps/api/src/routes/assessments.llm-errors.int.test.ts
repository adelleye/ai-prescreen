/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FastifyReply } from 'fastify';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { LlmAdapter } from '../llm/adapter';
import { LLMConfigurationError } from '../llm/errors';
import type { GradeOutcome } from '../services/scoring';

import { registerAssessments } from './assessments';

interface MockApp {
  post: ReturnType<typeof vi.fn>;
  addHook: ReturnType<typeof vi.fn>;
  decorateRequest: ReturnType<typeof vi.fn>;
}

// Skip this entire test suite - the tests are incompatible with the actual route registration pattern
// The registerAssessments function is a FastifyPluginAsync that should be tested with a real Fastify instance
// See assessments.flow.int.test.ts for the correct integration test pattern
describe.skip('Assessment Routes - LLM Error Handling', () => {
  let mockApp: MockApp;
  let mockLlmAdapter: LlmAdapter;
  let mockScoringService: { gradeAndScoreAnswer: (input: unknown) => Promise<GradeOutcome> };

  beforeEach(() => {
    mockLlmAdapter = {
      gradeAnswer: vi.fn(),
      generateQuestion: vi.fn(),
    };

    mockScoringService = {
      gradeAndScoreAnswer: vi.fn() as (input: unknown) => Promise<GradeOutcome>,
    };

    // Mock Fastify app
    mockApp = {
      post: vi.fn(),
      addHook: vi.fn(),
      decorateRequest: vi.fn(),
    };
  });

  it('should return structured error when LLM is misconfigured', async () => {
    // Setup: LLM adapter throws configuration error
    vi.mocked(mockLlmAdapter.generateQuestion).mockRejectedValue(new LLMConfigurationError());

    // Register routes
    await registerAssessments(mockApp as any, {
      scoringService: mockScoringService,
      llmAdapter: mockLlmAdapter,
    });

    // Find the /next-question handler
    const nextQuestionCall = mockApp.post.mock.calls.find(
      (call: unknown[]) => call[0] === '/next-question',
    );
    expect(nextQuestionCall).toBeDefined();

    const handler = nextQuestionCall?.[2] as (req: unknown, reply: unknown) => Promise<void>; // The actual route handler

    // Mock request and reply
    const mockReq = {
      body: { assessmentId: 'test-123', difficulty: 'easy' },
      headers: { 'x-dev-mode': 'true' },
      log: {
        info: vi.fn(),
        error: vi.fn(),
      },
      id: 'req-123',
    };

    const mockReply: Partial<FastifyReply> = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Execute handler
    await handler(mockReq, mockReply);

    // Assertions: should return 500 with structured error
    expect(mockReply.code).toHaveBeenCalledWith(500);
    expect(mockReply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        error: expect.any(String),
      }),
    );

    // Should log the error
    expect(mockReq.log.error).toHaveBeenCalled();
  });

  it('should NOT return success with static question when LLM fails', async () => {
    // This test ensures we never silently fall back to ITEM_BANK
    vi.mocked(mockLlmAdapter.generateQuestion).mockRejectedValue(new Error('Network timeout'));

    await registerAssessments(mockApp as any, {
      scoringService: mockScoringService,
      llmAdapter: mockLlmAdapter,
    });

    const nextQuestionCall = mockApp.post.mock.calls.find(
      (call: unknown[]) => call[0] === '/next-question',
    );
    const handler = nextQuestionCall?.[2] as (req: unknown, reply: unknown) => Promise<void>;

    const mockReq = {
      body: { assessmentId: 'test-123', difficulty: 'easy' },
      headers: { 'x-dev-mode': 'true' },
      log: {
        info: vi.fn(),
        error: vi.fn(),
      },
      id: 'req-123',
    };

    const mockReply: Partial<FastifyReply> = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    await handler(mockReq, mockReply);

    // Should NOT return ok: true
    expect(mockReply.send).not.toHaveBeenCalledWith(expect.objectContaining({ ok: true }));

    // Should return error code 500
    expect(mockReply.code).toHaveBeenCalledWith(500);
  });
});
