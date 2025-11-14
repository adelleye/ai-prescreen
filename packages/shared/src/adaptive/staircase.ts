export type Difficulty = 'easy' | 'medium' | 'hard';

export interface ItemTemplate {
  id: string;
  difficulty: Difficulty;
  template: string;
  params: Record<string, string | number>;
  section: 'competence' | 'communication' | 'integrity';
}

export interface StaircaseState {
  step: Difficulty;
  askedIds: Set<string>;
  maxItems: number;
}

export interface SelectionResult {
  nextItem: ItemTemplate;
  nextState: StaircaseState;
}

export function createInitialStaircaseState(maxItems: number): StaircaseState {
  return { step: 'easy', askedIds: new Set<string>(), maxItems };
}

export function selectNextItem(
  state: StaircaseState,
  bank: ItemTemplate[],
  lastScore?: number
): SelectionResult | null {
  const nextStep = transitionStep(state.step, lastScore);
  const pool = bank.filter((i) => i.difficulty === nextStep && !state.askedIds.has(i.id));
  if (pool.length === 0) return null;
  const idx = Math.floor(Math.random() * pool.length);
  const nextItem = pool[idx];
  if (!nextItem) return null;
  const nextState: StaircaseState = {
    step: nextStep,
    askedIds: new Set([...state.askedIds, nextItem.id]),
    maxItems: state.maxItems
  };
  return { nextItem, nextState };
}

export function transitionStep(current: Difficulty, lastScore?: number): Difficulty {
  if (lastScore === undefined) return current;
  if (lastScore >= 7) {
    return current === 'easy' ? 'medium' : 'hard';
  }
  if (lastScore <= 3) {
    return current === 'hard' ? 'medium' : 'easy';
  }
  return current;
}


