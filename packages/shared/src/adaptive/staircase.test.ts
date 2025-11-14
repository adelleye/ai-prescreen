import { describe, it, expect } from 'vitest';
import { createInitialStaircaseState, transitionStep, selectNextItem, type ItemTemplate } from './staircase';

describe('staircase', () => {
  it('initial state is easy with empty askedIds', () => {
    const s = createInitialStaircaseState(18);
    expect(s.step).toBe('easy');
    expect(s.askedIds.size).toBe(0);
    expect(s.maxItems).toBe(18);
  });

  it('transitions up on high score and down on low score, stable otherwise', () => {
    expect(transitionStep('easy', 7)).toBe('medium');
    expect(transitionStep('medium', 7)).toBe('hard');
    expect(transitionStep('hard', 7)).toBe('hard');

    expect(transitionStep('hard', 3)).toBe('medium');
    expect(transitionStep('medium', 3)).toBe('easy');
    expect(transitionStep('easy', 3)).toBe('easy');

    expect(transitionStep('medium', 5)).toBe('medium');
  });

  it('selectNextItem avoids repeats and respects difficulty', () => {
    const bank: ItemTemplate[] = [
      { id: 'e1', difficulty: 'easy', template: 'E1', params: {}, section: 'communication' },
      { id: 'm1', difficulty: 'medium', template: 'M1', params: {}, section: 'communication' },
      { id: 'h1', difficulty: 'hard', template: 'H1', params: {}, section: 'communication' },
    ];
    let state = createInitialStaircaseState(18);
    const first = selectNextItem(state, bank);
    expect(first?.nextItem.difficulty).toBe('easy');
    state = first!.nextState;
    const second = selectNextItem(state, bank, 8);
    expect(second?.nextItem.difficulty).toBe('medium');
    expect(second?.nextState.askedIds.has(first!.nextItem.id)).toBe(true);
  });
});


