import { describe, expect, it } from 'vitest';

import { computeIntegrityRisk, type IntegrityEvent } from './risk';

describe('computeIntegrityRisk', () => {
  const baseTime = new Date().toISOString();

  describe('basic functionality', () => {
    it('caps risk at 1.0 and bands correctly', () => {
      const events: IntegrityEvent[] = [
        { type: 'visibilitychange', at: baseTime, itemId: 'q1' },
        { type: 'visibilitychange', at: baseTime, itemId: 'q1' },
        { type: 'paste', at: baseTime, itemId: 'q2' },
        { type: 'paste', at: baseTime, itemId: 'q2' },
        { type: 'latencyOutlier', at: baseTime, itemId: 'q3' },
        { type: 'latencyOutlier', at: baseTime, itemId: 'q3' },
        { type: 'latencyOutlier', at: baseTime, itemId: 'q3' },
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

  describe('single signal types', () => {
    it('single paste event yields low-mid risk', () => {
      const events: IntegrityEvent[] = [{ type: 'paste', at: baseTime, itemId: 'q1' }];
      const res = computeIntegrityRisk(events);
      expect(res.risk).toBeGreaterThan(0);
      expect(res.band).toBe('Low');
      // Reason format: "{count} pastes on {itemId}"
      expect(res.reasons[0]).toMatch(/pastes/i);
    });

    it('single visibility change yields low risk', () => {
      const events: IntegrityEvent[] = [{ type: 'visibilitychange', at: baseTime, itemId: 'q1' }];
      const res = computeIntegrityRisk(events);
      expect(res.risk).toBe(0.05); // First visibility change = +0.05
      expect(res.band).toBe('Low');
    });

    it('single latency outlier yields low risk', () => {
      const events: IntegrityEvent[] = [{ type: 'latencyOutlier', at: baseTime, itemId: 'q1' }];
      const res = computeIntegrityRisk(events);
      expect(res.risk).toBe(0.1); // Latency outlier = +0.10
      expect(res.band).toBe('Low');
    });
  });

  describe('multiple events on same item', () => {
    it('multiple visibility changes on same item use flat +0.15 increment', () => {
      const events: IntegrityEvent[] = [
        { type: 'visibilitychange', at: baseTime, itemId: 'q1' },
        { type: 'visibilitychange', at: baseTime, itemId: 'q1' },
      ];
      const res = computeIntegrityRisk(events);
      // Implementation: vis === 1 ? 0.05 : 0.15
      // So 2 visibility changes = 0.15 (not 0.05 + 0.15)
      expect(res.risk).toBe(0.15);
      expect(res.band).toBe('Low');
      expect(res.reasons[0]).toMatch(/tab hides/i);
    });

    it('multiple pastes on same item accumulate risk', () => {
      const events: IntegrityEvent[] = [
        { type: 'paste', at: baseTime, itemId: 'q1' },
        { type: 'paste', at: baseTime, itemId: 'q1' },
      ];
      const res = computeIntegrityRisk(events);
      // Implementation: 0.05 + Math.max(0, 2-1) * 0.1 = 0.05 + 0.1 = 0.15
      expect(res.risk).toBeCloseTo(0.15, 10);
      expect(res.band).toBe('Low');
      expect(res.reasons[0]).toMatch(/pastes/i);
    });
  });

  describe('risk band transitions', () => {
    it('categorizes Low risk (< 0.3)', () => {
      const events: IntegrityEvent[] = [{ type: 'paste', at: baseTime, itemId: 'q1' }];
      const res = computeIntegrityRisk(events);
      expect(res.band).toBe('Low');
    });

    it('categorizes Med risk (0.3 <= risk < 0.7)', () => {
      const events: IntegrityEvent[] = [
        { type: 'visibilitychange', at: baseTime, itemId: 'q1' }, // 0.05
        { type: 'visibilitychange', at: baseTime, itemId: 'q1' }, // 0.15
        { type: 'paste', at: baseTime, itemId: 'q2' }, // 0.05
        { type: 'paste', at: baseTime, itemId: 'q2' }, // 0.10
        { type: 'paste', at: baseTime, itemId: 'q3' }, // 0.05
        { type: 'paste', at: baseTime, itemId: 'q3' }, // 0.10
      ];
      const res = computeIntegrityRisk(events);
      expect(res.band).toBe('Med');
      expect(res.risk).toBeGreaterThanOrEqual(0.3);
      expect(res.risk).toBeLessThan(0.7);
    });

    it('categorizes High risk (>= 0.7)', () => {
      const events: IntegrityEvent[] = [
        { type: 'paste', at: baseTime, itemId: 'q1' },
        { type: 'paste', at: baseTime, itemId: 'q1' },
        { type: 'paste', at: baseTime, itemId: 'q1' },
        { type: 'paste', at: baseTime, itemId: 'q1' },
        { type: 'paste', at: baseTime, itemId: 'q1' },
        { type: 'paste', at: baseTime, itemId: 'q1' },
        { type: 'paste', at: baseTime, itemId: 'q1' },
        { type: 'visibilitychange', at: baseTime, itemId: 'q2' },
        { type: 'visibilitychange', at: baseTime, itemId: 'q2' },
        { type: 'visibilitychange', at: baseTime, itemId: 'q2' },
        { type: 'latencyOutlier', at: baseTime, itemId: 'q3' },
      ];
      const res = computeIntegrityRisk(events);
      expect(res.band).toBe('High');
      expect(res.risk).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe('cross-item risk aggregation', () => {
    it('aggregates risk across multiple items', () => {
      const events: IntegrityEvent[] = [
        { type: 'paste', at: baseTime, itemId: 'q1' }, // q1: 0.05
        { type: 'paste', at: baseTime, itemId: 'q2' }, // q2: 0.05
        { type: 'paste', at: baseTime, itemId: 'q3' }, // q3: 0.05
      ];
      const res = computeIntegrityRisk(events);
      expect(res.risk).toBeCloseTo(0.15, 10); // All first occurrence: 0.05 * 3
      expect(res.reasons.length).toBe(3);
    });

    it('tracks reasons with item identifiers', () => {
      const events: IntegrityEvent[] = [
        { type: 'paste', at: baseTime, itemId: 'q_abc123' },
        { type: 'paste', at: baseTime, itemId: 'q_abc123' },
        { type: 'visibilitychange', at: baseTime, itemId: 'q_xyz789' },
      ];
      const res = computeIntegrityRisk(events);
      // Check that reasons contain the item IDs
      const reasonText = res.reasons.join(' ');
      expect(reasonText).toMatch(/q_abc123/);
      expect(reasonText).toMatch(/q_xyz789/);
    });
  });

  describe('risk cap at 1.0', () => {
    it('caps total risk at 1.0 with many events', () => {
      const events: IntegrityEvent[] = [];
      // Generate 20 paste events
      for (let i = 0; i < 20; i++) {
        events.push({ type: 'paste', at: baseTime, itemId: `q${i}` });
      }
      const res = computeIntegrityRisk(events);
      expect(res.risk).toBeLessThanOrEqual(1);
      expect(res.risk).toBe(1); // Should be capped at 1.0
      expect(res.band).toBe('High');
    });

    it('maintains High band when capped', () => {
      const events: IntegrityEvent[] = Array(15)
        .fill(null)
        .map((_, i) => ({
          type: 'latencyOutlier' as const,
          at: baseTime,
          itemId: `q${i}`,
        }));
      const res = computeIntegrityRisk(events);
      expect(res.risk).toBe(1);
      expect(res.band).toBe('High');
    });
  });

  describe('reason generation', () => {
    it('includes top reasons in output', () => {
      const events: IntegrityEvent[] = [
        { type: 'paste', at: baseTime, itemId: 'q1' },
        { type: 'paste', at: baseTime, itemId: 'q1' },
        { type: 'visibilitychange', at: baseTime, itemId: 'q2' },
        { type: 'visibilitychange', at: baseTime, itemId: 'q2' },
        { type: 'latencyOutlier', at: baseTime, itemId: 'q3' },
      ];
      const res = computeIntegrityRisk(events);
      expect(res.reasons.length).toBeGreaterThan(0);
      expect(res.reasons.length).toBeLessThanOrEqual(5); // Max 5 reasons
    });

    it('reason format describes event type and item', () => {
      const events: IntegrityEvent[] = [
        { type: 'paste', at: baseTime, itemId: 'q_paste_001' },
        { type: 'paste', at: baseTime, itemId: 'q_paste_001' },
      ];
      const res = computeIntegrityRisk(events);
      // Reason format: "{count} {type} on {itemId}"
      const reasonText = res.reasons.join(' ');
      expect(reasonText).toMatch(/paste/i);
      expect(reasonText).toMatch(/q_paste_001/);
    });
  });

  describe('edge cases', () => {
    it('handles undefined itemId gracefully', () => {
      const events: IntegrityEvent[] = [
        { type: 'paste', at: baseTime },
        { type: 'paste', at: baseTime },
      ];
      const res = computeIntegrityRisk(events);
      expect(res.risk).toBeGreaterThan(0);
      expect(res.band).toBe('Low');
    });

    it('handles events without metadata', () => {
      const events: IntegrityEvent[] = [
        { type: 'focus', at: baseTime, itemId: 'q1' },
        { type: 'blur', at: baseTime, itemId: 'q1' },
      ];
      const res = computeIntegrityRisk(events);
      // Focus/blur may or may not contribute to risk score
      expect(res.risk).toBeDefined();
      expect(['Low', 'Med', 'High']).toContain(res.band);
    });

    it('handles mixed event types on same item', () => {
      const events: IntegrityEvent[] = [
        { type: 'paste', at: baseTime, itemId: 'q1' },
        { type: 'visibilitychange', at: baseTime, itemId: 'q1' },
        { type: 'latencyOutlier', at: baseTime, itemId: 'q1' },
      ];
      const res = computeIntegrityRisk(events);
      expect(res.risk).toBeGreaterThan(0);
      expect(res.reasons.length).toBeGreaterThan(0);
    });
  });
});
