import { describe, expect, it } from 'vitest';
import { ActionState } from './actions';

describe('ActionState', () => {
  it('reports pressed, held, and released edges', () => {
    const state = new ActionState();

    state.update(['confirm']);
    expect(state.get('confirm')).toEqual({
      down: true,
      pressed: true,
      released: false,
    });

    state.update(['confirm']);
    expect(state.get('confirm')).toEqual({
      down: true,
      pressed: false,
      released: false,
    });

    state.update([]);
    expect(state.get('confirm')).toEqual({
      down: false,
      pressed: false,
      released: true,
    });
  });

  it('accepts virtual and physical actions through one frame model', () => {
    const state = new ActionState();
    state.update(new Set(['left', 'attack']));
    expect(state.get('left').pressed).toBe(true);
    expect(state.get('attack').pressed).toBe(true);
    expect(state.get('right').down).toBe(false);
  });
});

