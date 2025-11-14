import { describe, it, expect } from 'vitest';
import { ITEM_BANK, renderTemplate } from './bank';

describe('ITEM_BANK', () => {
  it('should not contain test-only sentinel phrases', () => {
    const sentinelPhrases = ['bug triage', 'test question', 'placeholder', 'TODO'];
    
    for (const [jobId, items] of Object.entries(ITEM_BANK)) {
      for (const item of items) {
        const renderedText = renderTemplate(item.template, item.params).toLowerCase();
        
        for (const sentinel of sentinelPhrases) {
          expect(renderedText).not.toContain(sentinel.toLowerCase(), 
            `ITEM_BANK[${jobId}][${item.id}] contains test-only phrase: "${sentinel}"`
          );
        }
      }
    }
  });

  it('should have realistic finance questions', () => {
    const financeItems = ITEM_BANK['finance-ap'];
    expect(financeItems.length).toBeGreaterThan(0);
    
    // All questions should be relevant to finance/AP
    for (const item of financeItems) {
      const text = renderTemplate(item.template, item.params);
      expect(text.length).toBeGreaterThan(10); // Not empty or trivial
    }
  });

  it('should properly render templates', () => {
    const result = renderTemplate('Test {foo} and {bar}', { foo: 'hello', bar: 'world' });
    expect(result).toBe('Test hello and world');
  });

  it('should handle missing template params gracefully', () => {
    const result = renderTemplate('Test {missing}', {});
    expect(result).toBe('Test ');
  });
});

