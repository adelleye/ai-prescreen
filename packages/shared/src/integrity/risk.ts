export type IntegrityEvent = {
  type: 'visibilitychange' | 'paste' | 'blur' | 'focus' | 'latencyOutlier';
  at: string;
  itemId?: string;
  meta?: Record<string, unknown>;
};

export type IntegrityRisk = {
  risk: number;
  band: 'Low' | 'Med' | 'High';
  reasons: string[];
};

export function computeIntegrityRisk(events: IntegrityEvent[]): IntegrityRisk {
  const reasons: string[] = [];
  let risk = 0;

  // Group by type and by item
  const byItem: Record<string, IntegrityEvent[]> = {};
  for (const e of events) {
    const key = e.itemId ?? 'unknown';
    const bucket = byItem[key] ?? [];
    bucket.push(e);
    byItem[key] = bucket;
  }

  for (const [itemId, evts] of Object.entries(byItem)) {
    const vis = evts.filter((e) => e.type === 'visibilitychange').length;
    const pst = evts.filter((e) => e.type === 'paste').length;
    const lat = evts.filter((e) => e.type === 'latencyOutlier').length;

    if (vis > 0) {
      const incr = vis === 1 ? 0.05 : 0.15;
      risk += incr;
      reasons.push(`${vis} tab hides on ${itemId}`);
    }
    if (pst > 0) {
      // First +0.05, subsequent +0.10
      risk += 0.05 + Math.max(0, pst - 1) * 0.1;
      reasons.push(`${pst} pastes on ${itemId}`);
    }
    if (lat > 0) {
      risk += 0.1 * lat;
      reasons.push(`${lat} latency outliers on ${itemId}`);
    }
  }

  // Cap at 1.0
  risk = Math.min(1, risk);
  const band: IntegrityRisk['band'] = risk < 0.3 ? 'Low' : risk < 0.7 ? 'Med' : 'High';

  // Make reasons concise: keep top 5
  const concise = reasons.slice(0, 5);
  return { risk, band, reasons: concise };
}
