import type { VisibilityPolicy, EventSnapshot } from '@hanabi/dsl';
import { evalExpr } from '@hanabi/dsl/src/runtimeExpr/evaluator.js';
import { parseExpr } from '@hanabi/dsl/src/runtimeExpr/parser.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function evalPolicy(expr: string | undefined, eventSnapshot: EventSnapshot): boolean {
  // No policy → visible by default
  if (!expr) return true;

  const parsed = parseExpr(expr);
  if (!parsed.ok) return true;

  const ctx = { event: eventSnapshot } as unknown as Parameters<typeof evalExpr>[1];
  const result = evalExpr(parsed.node, ctx);
  if (!result.ok) return true;
  return Boolean(result.value);
}

// ---------------------------------------------------------------------------
// evaluateResultsVisible
// ---------------------------------------------------------------------------

export function evaluateResultsVisible(
  policy: VisibilityPolicy,
  eventSnapshot: EventSnapshot,
): boolean {
  return evalPolicy(policy.results_visible, eventSnapshot);
}

// ---------------------------------------------------------------------------
// evaluateSpecsVisible
// ---------------------------------------------------------------------------

export function evaluateSpecsVisible(
  policy: VisibilityPolicy,
  eventSnapshot: EventSnapshot,
): boolean {
  return evalPolicy(policy.specs_visible, eventSnapshot);
}
