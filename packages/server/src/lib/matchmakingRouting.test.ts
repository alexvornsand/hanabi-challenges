import { describe, it, expect } from 'vitest';
import type { ScoringUnitSnapshot } from '@hanabi/dsl';
import { evalExpr } from '@hanabi/dsl/src/runtimeExpr/evaluator.js';
import { computeMatchGroups } from './matchmakingEngine.js';
import type { MatchGroup } from './matchmakingEngine.js';
import { applyRouting } from './routingEngine.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeUnit(id: number, rank: number, score = 0): ScoringUnitSnapshot {
  return {
    id,
    name: `Unit ${id}`,
    type: 'individual',
    score,
    rank,
    slot_results: [],
    section_scores: {},
    section_ranks: {},
    member_ids: [],
  };
}

// ---------------------------------------------------------------------------
// computeMatchGroups
// ---------------------------------------------------------------------------

describe('computeMatchGroups', () => {
  it('8 units, assignment: 2 → 4 groups', () => {
    const units = Array.from({ length: 8 }, (_, i) => makeUnit(i + 1, i + 1));
    const result = computeMatchGroups(
      { type: 'algorithmic', assignment: 2 },
      units,
      evalExpr,
    );

    expect(Array.isArray(result)).toBe(true);
    const groups = result as MatchGroup[];
    expect(groups).toHaveLength(4);
    expect(groups.every((g) => g.units.length === 2)).toBe(true);
  });

  it('order_by: "unit.rank" → units in rank order', () => {
    // Units with ranks 3, 1, 2 in shuffled order
    const units = [makeUnit(3, 3), makeUnit(1, 1), makeUnit(2, 2)];
    const result = computeMatchGroups(
      { type: 'algorithmic', assignment: 3, order_by: 'unit.rank' },
      units,
      evalExpr,
    );

    const groups = result as MatchGroup[];
    expect(groups).toHaveLength(1);
    // unit IDs should be in rank order: 1, 2, 3
    expect(groups[0]!.units).toEqual([1, 2, 3]);
  });

  it('eligibility filter excludes units not meeting expression', () => {
    const units = [makeUnit(1, 1, 10), makeUnit(2, 2, 5), makeUnit(3, 3, 15)];
    const result = computeMatchGroups(
      { type: 'algorithmic', assignment: 3, eligibility: 'unit.score > 7' },
      units,
      evalExpr,
    );

    const groups = result as MatchGroup[];
    // Only units 1 and 3 have score > 7
    const allUnitIds = groups.flatMap((g) => g.units);
    expect(allUnitIds).not.toContain(2);
    expect(allUnitIds).toContain(1);
    expect(allUnitIds).toContain(3);
  });

  it('deferred when assignment is dynamic', () => {
    const units = [makeUnit(1, 1), makeUnit(2, 2)];
    const result = computeMatchGroups(
      { type: 'algorithmic', assignment: 'dynamic' },
      units,
      evalExpr,
    );
    expect('kind' in result && result.kind === 'deferred').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyRouting
// ---------------------------------------------------------------------------

describe('applyRouting', () => {
  it('rank_1 → proceeds_to "R2-M1", rank_2 → eliminated with exitRound "R1-M1"', () => {
    const routing = {
      rank_1: { proceeds_to: 'R2-M1' },
      rank_2: { eliminated: true as const },
    };

    const results = applyRouting(
      routing,
      [{ rank: 1, unitId: 10 }, { rank: 2, unitId: 20 }],
      'R1-M1',
    );

    const dec1 = results.find((r) => r.unitId === 10)!;
    const dec2 = results.find((r) => r.unitId === 20)!;

    expect(dec1.outcome.kind).toBe('proceeds_to');
    if (dec1.outcome.kind === 'proceeds_to') {
      expect(dec1.outcome.targetSection).toBe('R2-M1');
    }

    expect(dec2.outcome.kind).toBe('eliminated');
    if (dec2.outcome.kind === 'eliminated') {
      expect(dec2.outcome.exitRound).toBe('R1-M1');
    }
  });

  it('default rule catches unmatched ranks', () => {
    const routing = {
      rank_1: { proceeds_to: 'Finals' },
      default: { eliminated: true as const },
    };

    const results = applyRouting(
      routing,
      [{ rank: 1, unitId: 1 }, { rank: 5, unitId: 5 }],
      'Semis',
    );

    const dec5 = results.find((r) => r.unitId === 5)!;
    expect(dec5.outcome.kind).toBe('eliminated');
  });
});
