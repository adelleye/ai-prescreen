import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FastifyReply } from 'fastify';
import { registerAssessments } from './assessments';
import type { LlmAdapter } from '../llm/adapter';
import type { ScoringService } from '../services/scoring';
import { LLMConfigurationError } from '../llm/errors';

describe('Assessment Routes - LLM Error Handling', () => {
  let mockApp: any;
  let mockLlmAdapter: LlmAdapter;
  let mockScoringService: ScoringService;

  beforeEach(() => {
    mockLlmAdapter = {
      gradeAnswer: vi.fn(),
      generateQuestion: vi.fn(),
    };

    mockScoringService = {
      gradeAndScoreAnswer: vi.fn(),
    } as any;

    // Mock Fastify app
    mockApp = {
      post: vi.fn(),
      addHook: vi.fn(),
      decorateRequest: vi.fn(),
    };
  });

  it('should return structured error when LLM is misconfigured', async () => {
    // Setup: LLM adapter throws configuration error
    vi.mocked(mockLlmAdapter.generateQuestion).mockRejectedValue(
      new LLMConfigurationError()
    );

    // Register routes
    await registerAssessments(mockApp, {
      scoringService: mockScoringService,
      llmAdapter: mockLlmAdapter,
    });

    // Find the /next-question handler
    const nextQuestionCall = mockApp.post.mock.calls.find(
      (call: any) => call[0] === '/next-question'
    );
    expect(nextQuestionCall).toBeDefined();

    const handler = nextQuestionCall[2]; // The actual route handler

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

    // Mock the query function to return assessment metadata
    vi.mock('../db', () => ({
      query: vi.fn((sql: string) => {
        if (sql.includes('select started_at')) {
          return Promise.resolve({
            rows: [{
              started_at: new Date().toISOString(),
              finished_at: null,
              job_id: 'finance-ap',
              n: '0'
            }],
          });
        }
        if (sql.includes('job_description') || sql.includes('applicant_resume')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes("response->>'answerText'")) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      }),
    }));

    // Execute handler
    await handler(mockReq, mockReply);

    // Assertions: should return 500 with structured error
    expect(mockReply.code).toHaveBeenCalledWith(500);
    expect(mockReply.send).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        error: expect.any(String),
      })
    );

    // Should log the error
    expect(mockReq.log.error).toHaveBeenCalled();
  });

  it('should NOT return success with static question when LLM fails', async () => {
    // This test ensures we never silently fall back to ITEM_BANK
    vi.mocked(mockLlmAdapter.generateQuestion).mockRejectedValue(
      new Error('Network timeout')
    );

    await registerAssessments(mockApp, {
      scoringService: mockScoringService,
      llmAdapter: mockLlmAdapter,
    });

    const nextQuestionCall = mockApp.post.mock.calls.find(
      (call: any) => call[0] === '/next-question'
    );
    const handler = nextQuestionCall[2];

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
    expect(mockReply.send).not.toHaveBeenCalledWith(
      expect.objectContaining({ ok: true })
    );

    // Should return error code 500
    expect(mockReply.code).toHaveBeenCalledWith(500);
  });
});

