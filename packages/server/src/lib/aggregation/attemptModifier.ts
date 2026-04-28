import type { AttemptModifier, GameResult } from '@hanabi/dsl';
import { evalExpr } from '@hanabi/dsl/src/runtimeExpr/evaluator.js';
import { parseExpr } from '@hanabi/dsl/src/runtimeExpr/parser.js';

type EvalFn = typeof evalExpr;

// ---------------------------------------------------------------------------
// applyAttemptModifier
// ---------------------------------------------------------------------------

/**
 * Given a list of game results representing attempts, apply the AttemptModifier
 * to produce a single aggregate score.
 *
 * Default behaviour (no config): max of item.points across all attempts.
 */
export function applyAttemptModifier(
  modifier: AttemptModifier,
  games: GameResult[],
  evalFn: EvalFn,
): number {
  if (!modifier.enabled || games.length === 0) return 0;

  // Respect `count` limit
  let attempts = games;
  if (modifier.count !== undefined && modifier.count !== 'unlimited') {
    attempts = games.slice(0, modifier.count);
  }

  if (!modifier.aggregation) {
    // Default: max points
    return Math.max(...attempts.map((g) => g.points));
  }

  // Delegate to absolute aggregation logic inline
  const config = modifier.aggregation;

  // Build item contexts and evaluate
  const valueExpr = 'value' in config ? (config.value ?? 'item.points') : 'item.points';
  const parsed = parseExpr(valueExpr);
  if (!parsed.ok) return 0;

  const values = attempts.map((game) => {
    const ctx = { item: game, game } as unknown as Parameters<EvalFn>[1];
    const result = evalFn(parsed.node, ctx);
    if (!result.ok) return 0;
    const v = result.value;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    return 0;
  });

  if (values.length === 0) return 0;

  const reduce = 'reduce' in config ? config.reduce : 'max';
  switch (reduce) {
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
      return Math.max(...values);
  }
}
