import type { DerivedRankingAgg, ScoringUnitSnapshot } from '@hanabi/dsl';
import { evalExpr } from '@hanabi/dsl/src/runtimeExpr/evaluator.js';
import { parseExpr } from '@hanabi/dsl/src/runtimeExpr/parser.js';

type EvalFn = typeof evalExpr;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DerivedRankingOutput {
  unitId: number;
  score: number;
  rank: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse "R3" → 3 for bracket round comparison. Returns null if not a round token. */
function parseRound(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^R(\d+)/.exec(s);
  return m ? parseInt(m[1]!, 10) : null;
}

function evalScore(
  expr: string,
  unit: ScoringUnitSnapshot,
  evalFn: EvalFn,
): number {
  const parsed = parseExpr(expr);
  if (!parsed.ok) return 0;
  const ctx = {
    unit,
    event: { slug: '', name: '', status: 'draft', sections: {} },
    section: { name: '', status: 'draft', time_window: {}, results: [] },
  } as unknown as Parameters<EvalFn>[1];
  const result = evalFn(parsed.node, ctx);
  if (!result.ok) return 0;
  const v = result.value;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return 0;
}

// ---------------------------------------------------------------------------
// computeDerivedRanking
// ---------------------------------------------------------------------------

export function computeDerivedRanking(
  config: DerivedRankingAgg,
  units: ScoringUnitSnapshot[],
  evalFn: EvalFn,
): DerivedRankingOutput[] {
  // Evaluate the score expression for each unit
  const scored: Array<{ unit: ScoringUnitSnapshot; score: number }> = units.map((unit) => ({
    unit,
    score: evalScore(config.score, unit, evalFn),
  }));

  const rankByExprs = config.rank_by ?? [];
  const rankDirections = config.rank_directions ?? [];

  // Sort by rank_by list, then by score as fallback
  scored.sort((a, b) => {
    for (let i = 0; i < rankByExprs.length; i++) {
      const expr = rankByExprs[i]!;
      const dir = rankDirections[i] ?? 'descending';

      // Special handling for advancement_round: "R3" > "R2" (higher round = advanced further = better)
      if (expr === 'unit.advancement_round' || expr === 'advancement_round') {
        const ra = parseRound(a.unit.advancement_round);
        const rb = parseRound(b.unit.advancement_round);
        if (ra !== null && rb !== null && ra !== rb) {
          return dir === 'descending' ? rb - ra : ra - rb;
        }
        continue;
      }

      const va = evalScore(expr, a.unit, evalFn);
      const vb = evalScore(expr, b.unit, evalFn);
      if (va !== vb) {
        return dir === 'descending' ? vb - va : va - vb;
      }
    }
    // Default: sort by score descending
    return b.score - a.score;
  });

  // Build output with sort-key to detect ties
  const rows: Array<DerivedRankingOutput & { _sortKey: string }> = scored.map(({ unit, score }) => {
    // Build a composite sort key for tie detection: advancement_round + score
    const roundKey = parseRound(unit.advancement_round) ?? -1;
    return { unitId: unit.id, score, rank: 0, _sortKey: `${roundKey}:${score}` };
  });

  // Assign ranks: same position in sort = same rank only when sort keys match
  let currentRank = 1;
  for (let i = 0; i < rows.length; i++) {
    if (i > 0 && rows[i]!._sortKey !== rows[i - 1]!._sortKey) {
      currentRank = i + 1;
    }
    rows[i]!.rank = currentRank;
  }

  return rows.map(({ unitId, score, rank }) => ({ unitId, score, rank }));
}
