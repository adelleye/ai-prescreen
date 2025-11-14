import { describe, expect, it } from 'vitest';

import { computeIntegrityRisk, type IntegrityEvent } from './risk';

describe('computeIntegrityRisk', () => {
  it('caps risk at 1.0 and bands correctly', () => {
    const events: IntegrityEvent[] = [
      { type: 'visibilitychange', at: new Date().toISOString(), itemId: 'q1' },
      { type: 'visibilitychange', at: new Date().toISOString(), itemId: 'q1' },
      { type: 'paste', at: new Date().toISOString(), itemId: 'q2' },
      { type: 'paste', at: new Date().toISOString(), itemId: 'q2' },
      { type: 'latencyOutlier', at: new Date().toISOString(), itemId: 'q3' },
      { type: 'latencyOutlier', at: new Date().toISOString(), itemId: 'q3' },
      { type: 'latencyOutlier', at: new Date().toISOString(), itemId: 'q3' },
    ];
    const res = computeIntegrityRisk(events);
    expect(res.risk).toBeLessThanOrEqual(1);
    expect(['Low', 'Med', 'High']).toContain(res.band);
    expect(res.reasons.length).toBeGreaterThan(0);
  });

  it('zero events yields low risk with empty or minimal reasons', () => {
    const res = computeIntegrityRisk([]);
    expect(res.risk).toBe(0);
    expect(res.band).toBe('Low');
  });
});
