import type {
  AbsoluteAgg,
  ScoringUnitSnapshot,
  SlotResultSnapshot,
  GameResult,
} from '@hanabi/dsl';
import { parseExpr } from '@hanabi/dsl/src/runtimeExpr/parser.js';
import { evalExpr } from '@hanabi/dsl/src/runtimeExpr/evaluator.js';

type EvalFn = typeof evalExpr;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function unwrapNumber(outcome: ReturnType<EvalFn>): number {
  if (!outcome.ok) return 0;
  const v = outcome.value;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return 0;
}

function unwrapBoolean(outcome: ReturnType<EvalFn>): boolean {
  if (!outcome.ok) return false;
  const v = outcome.value;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v === null || v === undefined) return false;
  return Boolean(v);
}

function evalGame(expr: string, game: GameResult, unit: ScoringUnitSnapshot, evalFn: EvalFn) {
  const parsed = parseExpr(expr);
  if (!parsed.ok) return { ok: false as const, message: parsed.message };
  // `item` is the game object — value expressions like "item.points" walk context.item
  const ctx = {
    game,
    unit,
    item: game,
    event: { slug: '', name: '', status: 'draft', sections: {} },
  } as unknown as Parameters<EvalFn>[1];
  return evalFn(parsed.node, ctx);
}

/**
 * Flatten all games from all slots in the unit.
 */
function flattenGames(slotResults: SlotResultSnapshot[]): Array<{ game: GameResult }> {
  const out: Array<{ game: GameResult }> = [];
  for (const sr of slotResults) {
    for (const g of sr.games) {
      out.push({ game: g });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// computeAbsoluteAgg
// ---------------------------------------------------------------------------

export function computeAbsoluteAgg(
  config: AbsoluteAgg,
  input: { unit: ScoringUnitSnapshot; slotResults: SlotResultSnapshot[] },
  evalFn: EvalFn,
): number {
  const { unit, slotResults } = input;
  let items = flattenGames(slotResults);

  // 1. Filter by `where`
  if (config.where) {
    const whereExpr = config.where;
    items = items.filter(({ game }) =>
      unwrapBoolean(evalGame(whereExpr, game, unit, evalFn)),
    );
  }

  // 2. Sort by `sort_by`
  if (config.sort_by) {
    const sortExpr = config.sort_by;
    const direction = config.sort_direction ?? 'descending';
    items.sort((a, b) => {
      const va = unwrapNumber(evalGame(sortExpr, a.game, unit, evalFn));
      const vb = unwrapNumber(evalGame(sortExpr, b.game, unit, evalFn));
      return direction === 'ascending' ? va - vb : vb - va;
    });
  }

  // 3. Skip
  if (config.skip && config.skip > 0) {
    items = items.slice(config.skip);
  }

  // 4. Take
  if (config.take !== undefined && config.take !== 'unlimited') {
    items = items.slice(0, config.take);
  }

  // 5. Evaluate value expression per item
  const valueExpr = config.value ?? 'item.points';
  const values = items.map(({ game }) =>
    unwrapNumber(evalGame(valueExpr, game, unit, evalFn)),
  );

  // 6. Reduce
  if (values.length === 0) return 0;

  switch (config.reduce) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);
    case 'count':
      return values.length;
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'first':
      return values[0]!;
    case 'latest':
      return values[values.length - 1]!;
    default:
      return values.reduce((a, b) => a + b, 0);
  }
}

// ---------------------------------------------------------------------------
// applyUnitAttribution
// ---------------------------------------------------------------------------

export function applyUnitAttribution(
  teamScore: number,
  attribution: 'share' | 'split',
  memberCount: number,
): number {
  if (attribution === 'split' && memberCount > 0) {
    return teamScore / memberCount;
  }
  return teamScore;
}
