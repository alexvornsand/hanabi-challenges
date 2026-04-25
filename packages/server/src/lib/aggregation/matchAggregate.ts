import type { MatchAggregateAgg, ScoringUnitSnapshot, GameResult, ComparatorInput } from '@hanabi/dsl';
import { evalExpr } from '@hanabi/dsl/src/runtimeExpr/evaluator.js';
import { parseExpr } from '@hanabi/dsl/src/runtimeExpr/parser.js';

type EvalFn = typeof evalExpr;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * One head-to-head match between two units. Each unit has their own game
 * result (same seed, different players → different outcome).
 */
export interface MatchResult {
  gameA: GameResult;
  gameB: GameResult;
  unitA: ScoringUnitSnapshot;
  unitB: ScoringUnitSnapshot;
}

export interface MatchAggregateOutput {
  unitId: number;
  matchPoints: number;
  wins: number;
  draws: number;
  losses: number;
  rank: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function comparatorSpec(
  comp: ComparatorInput,
): { expr: string; direction: 'higher' | 'lower' | 'true_better' } {
  if (typeof comp === 'string') {
    const shorthands: Record<string, { expr: string; direction: 'higher' | 'lower' | 'true_better' }> = {
      points:       { expr: 'item.points', direction: 'higher' },
      max_score:    { expr: 'item.max_score', direction: 'true_better' },
      points_star:  { expr: 'item.points_star', direction: 'higher' },
      bdr:          { expr: 'item.bdr', direction: 'higher' },
      turn_count:   { expr: 'item.turn_count', direction: 'lower' },
      strikes:      { expr: 'item.strikes', direction: 'lower' },
      elapsed_time: { expr: 'item.elapsed_time', direction: 'lower' },
    };
    return shorthands[comp] ?? { expr: comp, direction: 'higher' };
  }
  return comp;
}

function evalComparator(
  expr: string,
  game: GameResult,
  unit: ScoringUnitSnapshot,
  evalFn: EvalFn,
): unknown {
  const parsed = parseExpr(expr);
  if (!parsed.ok) return null;
  const ctx = {
    game,
    unit,
    item: game,
    event: { slug: '', name: '', status: 'draft', sections: {} },
  } as unknown as Parameters<EvalFn>[1];
  const result = evalFn(parsed.node, ctx);
  return result.ok ? result.value : null;
}

function compareValues(
  va: unknown,
  vb: unknown,
  direction: 'higher' | 'lower' | 'true_better',
): number {
  if (direction === 'true_better') {
    const ba = !!va;
    const bb = !!vb;
    if (ba && !bb) return 1;
    if (!ba && bb) return -1;
    return 0;
  }
  const na = typeof va === 'number' ? va : 0;
  const nb = typeof vb === 'number' ? vb : 0;
  return direction === 'higher' ? na - nb : nb - na;
}

// ---------------------------------------------------------------------------
// computeMatchAggregate
// ---------------------------------------------------------------------------

export function computeMatchAggregate(
  config: MatchAggregateAgg,
  matches: MatchResult[],
  units: ScoringUnitSnapshot[],
  evalFn: EvalFn,
): MatchAggregateOutput[] {
  const winPts = config.win_points ?? 2;
  const drawPts = config.draw_points ?? 1;
  const lossPts = config.loss_points ?? 0;

  const accum = new Map<number, { matchPoints: number; wins: number; draws: number; losses: number }>();
  for (const u of units) {
    accum.set(u.id, { matchPoints: 0, wins: 0, draws: 0, losses: 0 });
  }

  for (const { gameA, gameB, unitA, unitB } of matches) {
    const comparators = config.match_comparators.map(comparatorSpec);
    let winner: 'A' | 'B' | 'draw' = 'draw';

    for (const comp of comparators) {
      const va = evalComparator(comp.expr, gameA, unitA, evalFn);
      const vb = evalComparator(comp.expr, gameB, unitB, evalFn);
      const cmp = compareValues(va, vb, comp.direction);
      if (cmp > 0) { winner = 'A'; break; }
      if (cmp < 0) { winner = 'B'; break; }
    }

    const aEntry = accum.get(unitA.id) ?? { matchPoints: 0, wins: 0, draws: 0, losses: 0 };
    const bEntry = accum.get(unitB.id) ?? { matchPoints: 0, wins: 0, draws: 0, losses: 0 };

    if (winner === 'A') {
      aEntry.matchPoints += winPts;  aEntry.wins += 1;
      bEntry.matchPoints += lossPts; bEntry.losses += 1;
    } else if (winner === 'B') {
      bEntry.matchPoints += winPts;  bEntry.wins += 1;
      aEntry.matchPoints += lossPts; aEntry.losses += 1;
    } else {
      aEntry.matchPoints += drawPts; aEntry.draws += 1;
      bEntry.matchPoints += drawPts; bEntry.draws += 1;
    }

    accum.set(unitA.id, aEntry);
    accum.set(unitB.id, bEntry);
  }

  const rows: MatchAggregateOutput[] = units.map((u) => {
    const entry = accum.get(u.id) ?? { matchPoints: 0, wins: 0, draws: 0, losses: 0 };
    return { unitId: u.id, ...entry, rank: 0 };
  });

  rows.sort((a, b) => b.matchPoints - a.matchPoints);

  let currentRank = 1;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i]!.matchPoints < rows[i - 1]!.matchPoints) {
      currentRank = i + 1;
    }
    rows[i]!.rank = currentRank;
  }

  return rows;
}
