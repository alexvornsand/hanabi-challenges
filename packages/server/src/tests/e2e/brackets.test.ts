/**
 * Bracket End-to-End Test
 *
 * Tests: single-elimination bracket routing, advancement_round tracking,
 * and derived ranking.
 *
 * Pure computation — no DB required.
 * Run with: pnpm --filter @hanabi/server test:e2e
 */
import { describe, it, expect } from 'vitest';
import { applyRouting } from '../../lib/routingEngine.js';
import { computeDerivedRanking } from '../../lib/aggregation/derivedRanking.js';
import { evalExpr } from '@hanabi/dsl/src/runtimeExpr/evaluator.js';
import type { ScoringUnitSnapshot, RoutingBlock } from '@hanabi/dsl';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUnit(
  id: number,
  name: string,
  score = 0,
  advancement_round: string | null = null,
): ScoringUnitSnapshot {
  return {
    id,
    name,
    type: 'individual',
    score,
    rank: 0,
    slot_results: [],
    advancement_round,
    section_scores: {},
    section_ranks: {},
    member_ids: [],
  };
}

// Routing for a single-elimination match: winner advances, loser is eliminated
const matchRouting: RoutingBlock = {
  rank_1: { proceeds_to: 'R2-M1' },
  rank_2: { eliminated: true },
};

// Routing for the final: winner gets rank 1, finalist is eliminated
const finalRouting: RoutingBlock = {
  rank_1: { assigned_rank: 1 },
  rank_2: { eliminated: true },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Single-elimination bracket — routing and derived ranking', () => {
  it('R1-M1: A (rank 1) proceeds to R2-M1; B (rank 2) is eliminated', () => {
    const decisions = applyRouting(matchRouting, [{ rank: 1, unitId: 1 }, { rank: 2, unitId: 2 }], 'R1-M1');

    const aDecision = decisions.find((d) => d.unitId === 1);
    const bDecision = decisions.find((d) => d.unitId === 2);

    expect(aDecision?.outcome.kind).toBe('proceeds_to');
    if (aDecision?.outcome.kind === 'proceeds_to') {
      expect(aDecision.outcome.targetSection).toBe('R2-M1');
    }

    expect(bDecision?.outcome.kind).toBe('eliminated');
    if (bDecision?.outcome.kind === 'eliminated') {
      expect(bDecision.outcome.exitRound).toBe('R1-M1');
    }
  });

  it('R1-M2: C (rank 1) proceeds to R2-M1; D (rank 2) is eliminated', () => {
    const decisions = applyRouting(matchRouting, [{ rank: 1, unitId: 3 }, { rank: 2, unitId: 4 }], 'R1-M2');

    const cDecision = decisions.find((d) => d.unitId === 3);
    const dDecision = decisions.find((d) => d.unitId === 4);

    expect(cDecision?.outcome.kind).toBe('proceeds_to');
    expect(dDecision?.outcome.kind).toBe('eliminated');
    if (dDecision?.outcome.kind === 'eliminated') {
      expect(dDecision.outcome.exitRound).toBe('R1-M2');
    }
  });

  it('R2-M1 (final): A (rank 1) wins; C (rank 2) is eliminated', () => {
    const decisions = applyRouting(finalRouting, [{ rank: 1, unitId: 1 }, { rank: 2, unitId: 3 }], 'R2-M1');

    const aDecision = decisions.find((d) => d.unitId === 1);
    const cDecision = decisions.find((d) => d.unitId === 3);

    expect(aDecision?.outcome.kind).toBe('assigned_rank');
    if (aDecision?.outcome.kind === 'assigned_rank') {
      expect(aDecision.outcome.rank).toBe(1);
    }

    expect(cDecision?.outcome.kind).toBe('eliminated');
    if (cDecision?.outcome.kind === 'eliminated') {
      expect(cDecision.outcome.exitRound).toBe('R2-M1');
    }
  });

  it('derived ranking: A=1, C=2, B and D tied at rank 3', () => {
    // After bracket completion:
    //   A: won the final — score 1, no elimination round
    //   C: lost in final (R2-M1) — advancement_round = "R2-M1"
    //   B: lost in R1-M1 — advancement_round = "R1-M1"
    //   D: lost in R1-M2 — advancement_round = "R1-M2"
    const unitA = makeUnit(1, 'A', 1, null);
    const unitC = makeUnit(3, 'C', 0, 'R2-M1');
    const unitB = makeUnit(2, 'B', 0, 'R1-M1');
    const unitD = makeUnit(4, 'D', 0, 'R1-M2');

    const config = {
      fn: 'derived_ranking' as const,
      score: 'unit.score',
      rank_by: ['unit.advancement_round'],
      rank_directions: ['descending' as const],
    };

    const results = computeDerivedRanking(config, [unitA, unitC, unitB, unitD], evalExpr);

    const rankOf = (id: number) => results.find((r) => r.unitId === id)?.rank;

    expect(rankOf(1)).toBe(1); // A — won
    expect(rankOf(3)).toBe(2); // C — lost in final (R2)
    expect(rankOf(2)).toBe(3); // B — lost in R1
    expect(rankOf(4)).toBe(3); // D — lost in R1, tied with B
  });
});
