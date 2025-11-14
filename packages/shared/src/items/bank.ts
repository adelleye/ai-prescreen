import type { ItemTemplate } from '../adaptive/staircase';

export type JobId = 'finance-ap' | 'sales-sdr';

export const ITEM_BANK: Record<JobId, ItemTemplate[]> = {
  'finance-ap': [
    {
      id: 'e1',
      difficulty: 'easy',
      template: 'How would you verify a {type} before processing payment?',
      params: { type: 'vendor invoice' },
      section: 'communication',
    },
    {
      id: 'm1',
      difficulty: 'medium',
      template: 'A vendor requests ₦{amount} without PO. What controls?',
      params: { amount: 500000 },
      section: 'competence',
    },
    {
      id: 'h1',
      difficulty: 'hard',
      template: 'You find a policy conflict between finance and ops. Next steps?',
      params: {},
      section: 'communication',
    },
  ],
  'sales-sdr': [
    {
      id: 'e1',
      difficulty: 'easy',
      template: 'How would you qualify an inbound lead for {product}?',
      params: { product: 'SaaS' },
      section: 'communication',
    },
  ],
};

export function renderTemplate(tpl: string, params: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ''));
}

export function getQuestionText(jobId: string, itemId: string): string | undefined {
  const bank = ITEM_BANK[jobId as JobId];
  if (!bank) return undefined;
  const item = bank.find((i) => i.id === itemId);
  if (!item) return undefined;
  return renderTemplate(item.template, item.params);
}


