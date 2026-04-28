import { describe, it, expect } from 'vitest';
import { parseExpr } from './parser.js';
import { evalExpr } from './evaluator.js';
import type { GameContext, ScoringUnitContext, GameResult, ScoringUnitSnapshot } from '../types.js';

function makeUnit(overrides: Partial<ScoringUnitSnapshot> = {}): ScoringUnitSnapshot {
  return {
    id: 1,
    name: 'Test Unit',
    type: 'individual',
    score: 100,
    rank: 1,
    slot_results: [],
    section_scores: {},
    section_ranks: {},
    member_ids: [1],
    ...overrides,
  };
}

function makeGame(overrides: Partial<GameResult> = {}): GameResult {
  return {
    points: 25,
    max_score: true,
    participants: [1, 2],
    ...overrides,
  };
}

function makeGameCtx(gameOverrides: Partial<GameResult> = {}): GameContext {
  return {
    game: makeGame(gameOverrides),
    unit: makeUnit(),
    event: {
      slug: 'test',
      name: 'Test Event',
      status: 'published',
      sections: {},
    },
  };
}

function eval_(expr: string, ctx: GameContext | ScoringUnitContext) {
  const parsed = parseExpr(expr);
  if (!parsed.ok) throw new Error(`Parse error: ${parsed.message}`);
  return evalExpr(parsed.node, ctx);
}

describe('evalExpr — path access', () => {
  it('game.points in game context → correct value', () => {
    const ctx = makeGameCtx({ points: 24 });
    const result = eval_('game.points', ctx);
    expect(result).toEqual({ ok: true, value: 24 });
  });

  it('deep path access', () => {
    const ctx = makeGameCtx();
    const result = eval_('game.participants', ctx);
    expect(result).toEqual({ ok: true, value: [1, 2] });
  });
});

describe('evalExpr — binary operators', () => {
  it('unit.score >= 90 → true', () => {
    const unit = makeUnit({ score: 95 });
    const ctx: ScoringUnitContext = {
      unit,
      section: { name: 'Test', status: 'published', time_window: {}, results: [] },
      event: { slug: 'test', name: 'Test', status: 'published', sections: {} },
    };
    const result = eval_('unit.score >= 90', ctx);
    expect(result).toEqual({ ok: true, value: true });
  });

  it('unit.score >= 90 → false', () => {
    const unit = makeUnit({ score: 80 });
    const ctx: ScoringUnitContext = {
      unit,
      section: { name: 'Test', status: 'published', time_window: {}, results: [] },
      event: { slug: 'test', name: 'Test', status: 'published', sections: {} },
    };
    const result = eval_('unit.score >= 90', ctx);
    expect(result).toEqual({ ok: true, value: false });
  });
});

describe('evalExpr — array filter', () => {
  it('.where(sr => sr.score > 0) → filtered array', () => {
    const ctx = makeGameCtx();
    // Inject items into context
    const ctxWithItems = { ...ctx, items: [{ score: 5 }, { score: 0 }, { score: 3 }] } as unknown as GameContext;
    const parsed = parseExpr('items.where(sr => sr.score > 0)');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = evalExpr(parsed.node, ctxWithItems);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([{ score: 5 }, { score: 3 }]);
    }
  });
});

describe('evalExpr — null coalesce', () => {
  it('unit.advancement_round ?? -1 → -1 when null', () => {
    const unit = makeUnit({ advancement_round: null });
    const ctx: ScoringUnitContext = {
      unit,
      section: { name: 'Test', status: 'published', time_window: {}, results: [] },
      event: { slug: 'test', name: 'Test', status: 'published', sections: {} },
    };
    const result = eval_('unit.advancement_round ?? -1', ctx);
    expect(result).toEqual({ ok: true, value: -1 });
  });
});

describe('evalExpr — participant set equality', () => {
  it('[1,2] equals [2,1]', () => {
    const ctx = {
      a: { participants: [1, 2] },
      b: { participants: [2, 1] },
    } as unknown as GameContext;
    const parsed = parseExpr('a.participants == b.participants');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = evalExpr(parsed.node, ctx);
    expect(result).toEqual({ ok: true, value: true });
  });

  it('[1,2] does not equal [1,3]', () => {
    const ctx = {
      a: { participants: [1, 2] },
      b: { participants: [1, 3] },
    } as unknown as GameContext;
    const parsed = parseExpr('a.participants == b.participants');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = evalExpr(parsed.node, ctx);
    expect(result).toEqual({ ok: true, value: false });
  });
});

describe('evalExpr — cross-event reference', () => {
  it('event["slug"] → EvalError with deferred message', () => {
    const ctx = makeGameCtx();
    const parsed = parseExpr('event["nvc"]');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = evalExpr(parsed.node, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain('deferred');
    }
  });
});

describe('evalExpr — built-ins', () => {
  it('now() returns a number', () => {
    const parsed = parseExpr('now()');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = evalExpr(parsed.node, makeGameCtx());
    expect(result.ok).toBe(true);
    if (result.ok) expect(typeof result.value).toBe('number');
  });

  it('days(1) returns 86400000', () => {
    const parsed = parseExpr('days(1)');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = evalExpr(parsed.node, makeGameCtx());
    expect(result).toEqual({ ok: true, value: 86400000 });
  });
});

describe('evalExpr — ternary', () => {
  it('cond ? a : b evaluates branch', () => {
    const ctx = { flag: true, x: 1, y: 2 } as unknown as GameContext;
    const parsed = parseExpr('flag ? x : y');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const result = evalExpr(parsed.node, ctx);
    expect(result).toEqual({ ok: true, value: 1 });
  });
});
