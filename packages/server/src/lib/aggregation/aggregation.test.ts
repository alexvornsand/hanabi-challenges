import { describe, it, expect } from 'vitest';
import type {
  ScoringUnitSnapshot,
  SlotResultSnapshot,
  GameResult,
  AttemptModifier,
} from '@hanabi/dsl';
import { evalExpr } from '@hanabi/dsl/src/runtimeExpr/evaluator.js';
import { computeAbsoluteAgg, applyUnitAttribution } from './absolute.js';
import { applyAttemptModifier } from './attemptModifier.js';
import { computeMatchAggregate } from './matchAggregate.js';
import type { MatchResult } from './matchAggregate.js';
import { computeElo } from './elo.js';
import { computeDerivedRanking } from './derivedRanking.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeGame(overrides: Partial<GameResult> = {}): GameResult {
  return {
    points: 0,
    max_score: false,
    participants: [],
    ...overrides,
  };
}

function makeUnit(overrides: Partial<ScoringUnitSnapshot> = {}): ScoringUnitSnapshot {
  return {
    id: 1,
    name: 'Unit',
    type: 'individual',
    score: 0,
    rank: 1,
    slot_results: [],
    section_scores: {},
    section_ranks: {},
    member_ids: [],
    ...overrides,
  };
}

function makeSlots(games: GameResult[]): SlotResultSnapshot[] {
  return [{ slot_index: 0, score: 0, games }];
}

// ---------------------------------------------------------------------------
// computeAbsoluteAgg
// ---------------------------------------------------------------------------

describe('computeAbsoluteAgg', () => {
  it('sum of [24, 25, 0] → 49', () => {
    const games = [makeGame({ points: 24 }), makeGame({ points: 25 }), makeGame({ points: 0 })];
    const unit = makeUnit({ slot_results: makeSlots(games) });
    const result = computeAbsoluteAgg(
      { reduce: 'sum' },
      { unit, slotResults: makeSlots(games) },
      evalExpr,
    );
    expect(result).toBe(49);
  });

  it('count with where: max_score filters correctly', () => {
    const games = [
      makeGame({ points: 25, max_score: true }),
      makeGame({ points: 20, max_score: false }),
      makeGame({ points: 25, max_score: true }),
    ];
    const unit = makeUnit({ slot_results: makeSlots(games) });
    const result = computeAbsoluteAgg(
      { reduce: 'count', where: 'item.max_score' },
      { unit, slotResults: makeSlots(games) },
      evalExpr,
    );
    expect(result).toBe(2);
  });

  it('best 3 of 5 games — sum of top 3', () => {
    const games = [
      makeGame({ points: 10 }),
      makeGame({ points: 20 }),
      makeGame({ points: 15 }),
      makeGame({ points: 5 }),
      makeGame({ points: 18 }),
    ];
    const unit = makeUnit({ slot_results: makeSlots(games) });
    const result = computeAbsoluteAgg(
      { reduce: 'sum', sort_by: 'item.points', sort_direction: 'descending', take: 3 },
      { unit, slotResults: makeSlots(games) },
      evalExpr,
    );
    // Top 3: 20, 18, 15 → 53
    expect(result).toBe(53);
  });

  it('returns 0 when no games', () => {
    const unit = makeUnit();
    const result = computeAbsoluteAgg(
      { reduce: 'sum' },
      { unit, slotResults: [] },
      evalExpr,
    );
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// applyUnitAttribution
// ---------------------------------------------------------------------------

describe('applyUnitAttribution', () => {
  it('split with 2 members → 45 from 90', () => {
    expect(applyUnitAttribution(90, 'split', 2)).toBe(45);
  });

  it('share returns full score', () => {
    expect(applyUnitAttribution(90, 'share', 2)).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// applyAttemptModifier
// ---------------------------------------------------------------------------

describe('applyAttemptModifier', () => {
  it('3 attempts [24, 22, 25] default → 25 (max)', () => {
    const games = [makeGame({ points: 24 }), makeGame({ points: 22 }), makeGame({ points: 25 })];
    const modifier: AttemptModifier = { enabled: true };
    expect(applyAttemptModifier(modifier, games, evalExpr)).toBe(25);
  });

  it('disabled modifier → 0', () => {
    const games = [makeGame({ points: 24 })];
    const modifier: AttemptModifier = { enabled: false };
    expect(applyAttemptModifier(modifier, games, evalExpr)).toBe(0);
  });

  it('respects count limit', () => {
    const games = [makeGame({ points: 50 }), makeGame({ points: 30 }), makeGame({ points: 40 })];
    const modifier: AttemptModifier = { enabled: true, count: 2 };
    // Only first 2: [50, 30] → max = 50
    expect(applyAttemptModifier(modifier, games, evalExpr)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// computeMatchAggregate
// ---------------------------------------------------------------------------

describe('computeMatchAggregate', () => {
  it('A beats B in all matches → A rank 1', () => {
    const unitA = makeUnit({ id: 1, name: 'A' });
    const unitB = makeUnit({ id: 2, name: 'B' });

    const matches: MatchResult[] = [
      { gameA: makeGame({ points: 20 }), gameB: makeGame({ points: 15 }), unitA, unitB },
      { gameA: makeGame({ points: 18 }), gameB: makeGame({ points: 12 }), unitA, unitB },
    ];

    const results = computeMatchAggregate(
      { fn: 'match_aggregate', match_comparators: ['points'] },
      matches,
      [unitA, unitB],
      evalExpr,
    );

    const rankA = results.find((r) => r.unitId === 1)!;
    const rankB = results.find((r) => r.unitId === 2)!;
    expect(rankA.rank).toBe(1);
    expect(rankB.rank).toBe(2);
    expect(rankA.wins).toBe(2);
    expect(rankB.losses).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computeElo
// ---------------------------------------------------------------------------

describe('computeElo', () => {
  it('winner rating increases, loser decreases', () => {
    const games = [{ unitAId: 1, unitBId: 2, score: 1 }]; // A wins
    const results = computeElo({ fn: 'elo' }, games, [1, 2]);
    const rA = results.find((r) => r.unitId === 1)!;
    const rB = results.find((r) => r.unitId === 2)!;
    expect(rA.rating).toBeGreaterThan(1500);
    expect(rB.rating).toBeLessThan(1500);
    expect(rA.rank).toBe(1);
  });

  it('draw leaves both near initial rating', () => {
    const games = [{ unitAId: 1, unitBId: 2, score: 0.5 }];
    const results = computeElo({ fn: 'elo' }, games, [1, 2]);
    const rA = results.find((r) => r.unitId === 1)!;
    const rB = results.find((r) => r.unitId === 2)!;
    // Both should stay at 1500 (equal ratings + draw = no change)
    expect(rA.rating).toBeCloseTo(1500, 1);
    expect(rB.rating).toBeCloseTo(1500, 1);
  });
});

// ---------------------------------------------------------------------------
// computeDerivedRanking
// ---------------------------------------------------------------------------

describe('computeDerivedRanking', () => {
  it('unit eliminated in R3 ranks above unit eliminated in R2', () => {
    const unitR3 = makeUnit({ id: 1, name: 'R3', advancement_round: 'R3', score: 0 });
    const unitR2 = makeUnit({ id: 2, name: 'R2', advancement_round: 'R2', score: 0 });
    const unitR1 = makeUnit({ id: 3, name: 'R1', advancement_round: 'R1', score: 0 });

    const results = computeDerivedRanking(
      {
        fn: 'derived_ranking',
        score: 'unit.score',
        rank_by: ['unit.advancement_round'],
        rank_directions: ['descending'],
      },
      [unitR1, unitR2, unitR3],
      evalExpr,
    );

    const r3 = results.find((r) => r.unitId === 1)!;
    const r2 = results.find((r) => r.unitId === 2)!;
    const r1 = results.find((r) => r.unitId === 3)!;

    expect(r3.rank).toBeLessThan(r2.rank);
    expect(r2.rank).toBeLessThan(r1.rank);
  });

  it('sorts by score descending when no rank_by', () => {
    const units = [
      makeUnit({ id: 1, score: 10 }),
      makeUnit({ id: 2, score: 30 }),
      makeUnit({ id: 3, score: 20 }),
    ];
    const results = computeDerivedRanking(
      { fn: 'derived_ranking', score: 'unit.score' },
      units,
      evalExpr,
    );
    const sorted = [...results].sort((a, b) => a.rank - b.rank);
    expect(sorted[0]!.unitId).toBe(2); // score 30
    expect(sorted[1]!.unitId).toBe(3); // score 20
    expect(sorted[2]!.unitId).toBe(1); // score 10
  });
});
