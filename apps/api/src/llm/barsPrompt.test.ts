import { describe, expect, it } from 'vitest';

import { parseBarsFromModelText, buildBarsPrompt } from './barsPrompt';

describe('BARS prompt & parser', () => {
  it('parses strict JSON', () => {
    const text = `{"criteria":{"policyProcedure":2,"decisionQuality":3,"evidenceSpecificity":1},"followUp":"Be specific."}`;
    const res = parseBarsFromModelText(text);
    expect(res.criteria.policyProcedure).toBe(2);
    expect(res.followUp).toBeDefined();
  });

  it('parses JSON inside code fences', () => {
    const text =
      '```json\n{"criteria":{"policyProcedure":0,"decisionQuality":1,"evidenceSpecificity":2},"followUp":"Can you elaborate?"}\n```';
    const res = parseBarsFromModelText(text);
    expect(res.criteria.evidenceSpecificity).toBe(2);
    expect(res.followUp).toBe('Can you elaborate?');
  });

  it('rejects out-of-range values', () => {
    const text = `{"criteria":{"policyProcedure":5,"decisionQuality":1,"evidenceSpecificity":1}}`;
    expect(() => parseBarsFromModelText(text)).toThrow();
  });

  it('builds a prompt string with required fields', () => {
    const s = buildBarsPrompt({ itemId: 'x1', question: 'Q?', answer: 'A' });
    expect(s).toContain('Item: x1');
    expect(s).toContain('Question: Q?');
    expect(s).toContain('<USER_ANSWER>');
    expect(s).toContain('A');
    expect(s).toContain('</USER_ANSWER>');
  });

  it('includes job/applicant/history context when provided', () => {
    const s = buildBarsPrompt({
      itemId: 'm1',
      question: 'A vendor requests ₦500000 without PO. What controls?',
      answer: 'Ask for PO and approvals.',
      jobContext: 'Accounts Payable; controls: PO, 2-eyes, DOA',
      applicantContext: '3y AP, SAP',
      history: [
        {
          question: 'How would you verify a vendor invoice before processing payment?',
          answer: 'Check PO and approvals.',
        },
        { question: 'Another Q', answer: 'Another A' },
      ],
    });
    expect(s).toContain('JobContext: Accounts Payable; controls: PO, 2-eyes, DOA');
    expect(s).toContain('ApplicantContext: 3y AP, SAP');
    expect(s).toContain(
      'PreviousQ: How would you verify a vendor invoice before processing payment?',
    );
    expect(s).toContain('PreviousA: Check PO and approvals.');
  });
});
