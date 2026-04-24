import { describe, it, expect } from 'vitest';
import { builtinRegistry } from './registry.js';
import type { GameContext } from '../types.js';

function makeGameCtx(overrides: Partial<GameContext['game']> = {}): GameContext {
  return {
    game: {
      points: 25,
      max_score: true,
      participants: [1, 2],
      ...overrides,
    },
    unit: {
      id: 1,
      name: 'Test',
      type: 'individual',
      score: 0,
      rank: 1,
      slot_results: [],
      section_scores: {},
      section_ranks: {},
      member_ids: [1],
    },
    event: {
      slug: 'test',
      name: 'Test',
      status: 'published',
      sections: {},
    },
  };
}

describe('builtinRegistry', () => {
  it('has stable_partnership', () => {
    expect(builtinRegistry.has('stable_partnership')).toBe(true);
  });

  it('does not have consistent_partners', () => {
    expect(builtinRegistry.has('consistent_partners')).toBe(false);
  });

  it('has all expected built-ins', () => {
    expect(builtinRegistry.has('unit_exclusivity')).toBe(true);
    expect(builtinRegistry.has('participation_freshness')).toBe(true);
    expect(builtinRegistry.has('time_window_valid')).toBe(true);
    expect(builtinRegistry.has('tag_present')).toBe(true);
    expect(builtinRegistry.has('lineup_valid')).toBe(true);
  });
});

describe('time_window_valid', () => {
  const pred = builtinRegistry.get('time_window_valid')!;

  it('game in window → true', () => {
    const ctx = makeGameCtx({ datetime_start: '2024-06-15T10:00:00Z' });
    const result = pred.fn(ctx, {
      start: '2024-06-01T00:00:00Z',
      end: '2024-06-30T23:59:59Z',
    });
    expect(result).toBe(true);
  });

  it('game before window → false', () => {
    const ctx = makeGameCtx({ datetime_start: '2024-05-31T10:00:00Z' });
    const result = pred.fn(ctx, {
      start: '2024-06-01T00:00:00Z',
      end: '2024-06-30T23:59:59Z',
    });
    expect(result).toBe(false);
  });

  it('game after window → false', () => {
    const ctx = makeGameCtx({ datetime_start: '2024-07-01T10:00:00Z' });
    const result = pred.fn(ctx, {
      start: '2024-06-01T00:00:00Z',
      end: '2024-06-30T23:59:59Z',
    });
    expect(result).toBe(false);
  });
});

describe('tag_present', () => {
  const pred = builtinRegistry.get('tag_present')!;

  it('tag present → true', () => {
    const ctx = makeGameCtx({ tags: ['comp', 'speed'] });
    expect(pred.fn(ctx, { tag: 'comp' })).toBe(true);
  });

  it('tag absent → false', () => {
    const ctx = makeGameCtx({ tags: ['comp', 'speed'] });
    expect(pred.fn(ctx, { tag: 'ranked' })).toBe(false);
  });
});

describe('stable_partnership', () => {
  const pred = builtinRegistry.get('stable_partnership')!;

  it('stable pair (always same participants) → true', () => {
    const ctx = makeGameCtx({ participants: [1, 2] });
    const result = pred.fn(ctx, {
      prior_games: [
        { participants: [1, 2] },
        { participants: [1, 2] },
      ],
    });
    expect(result).toBe(true);
  });

  it('mixed player (different compositions) → false', () => {
    const ctx = makeGameCtx({ participants: [1, 2] });
    const result = pred.fn(ctx, {
      prior_games: [
        { participants: [1, 3] }, // player 1 played with player 3 before
      ],
    });
    expect(result).toBe(false);
  });

  it('no prior games → true', () => {
    const ctx = makeGameCtx({ participants: [1, 2] });
    const result = pred.fn(ctx, { prior_games: [] });
    expect(result).toBe(true);
  });
});

describe('participation_freshness', () => {
  const pred = builtinRegistry.get('participation_freshness')!;

  it('game with spec already played → false', () => {
    const ctx = makeGameCtx({ spec: 'p2v0sNVC1', participants: [1, 2] });
    const result = pred.fn(ctx, {
      prior_games: [{ spec: 'p2v0sNVC1', participants: [1, 2] }],
    });
    expect(result).toBe(false);
  });

  it('different spec → true', () => {
    const ctx = makeGameCtx({ spec: 'p2v0sNVC2', participants: [1, 2] });
    const result = pred.fn(ctx, {
      prior_games: [{ spec: 'p2v0sNVC1', participants: [1, 2] }],
    });
    expect(result).toBe(true);
  });

  it('no prior games → true', () => {
    const ctx = makeGameCtx({ spec: 'p2v0sNVC1' });
    const result = pred.fn(ctx, { prior_games: [] });
    expect(result).toBe(true);
  });
});
