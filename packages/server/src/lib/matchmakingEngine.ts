import type { MatchmakingAlgorithmic, ScoringUnitSnapshot } from '@hanabi/dsl';
import { evalExpr } from '@hanabi/dsl/src/runtimeExpr/evaluator.js';
import { parseExpr } from '@hanabi/dsl/src/runtimeExpr/parser.js';

type EvalFn = typeof evalExpr;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MatchGroup {
  units: number[];
}

export interface DeferredMatchGroup {
  kind: 'deferred';
  orderedUnitIds: number[];
}

export type MatchmakingResult = MatchGroup[] | DeferredMatchGroup;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function evalUnit(
  expr: string,
  unit: ScoringUnitSnapshot,
  evalFn: EvalFn,
): unknown {
  const parsed = parseExpr(expr);
  if (!parsed.ok) return null;
  const ctx = {
    unit,
    event: { slug: '', name: '', status: 'draft', sections: {} },
    section: { name: '', status: 'draft', time_window: {}, results: [] },
  } as unknown as Parameters<EvalFn>[1];
  const result = evalFn(parsed.node, ctx);
  return result.ok ? result.value : null;
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  return 0;
}

/** Fisher-Yates shuffle (in-place) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// computeMatchGroups
// ---------------------------------------------------------------------------

export function computeMatchGroups(
  config: MatchmakingAlgorithmic,
  eligibleUnits: ScoringUnitSnapshot[],
  evalFn: EvalFn,
): MatchmakingResult {
  // 1. Filter by eligibility expression
  let units = eligibleUnits;
  if (config.eligibility) {
    const eligExpr = config.eligibility;
    units = units.filter((u) => {
      const v = evalUnit(eligExpr, u, evalFn);
      return Boolean(v);
    });
  }

  // 2. Sort by order_by (default: random shuffle)
  if (config.order_by) {
    const orderExpr = config.order_by;
    units = [...units].sort((a, b) => {
      const va = toNumber(evalUnit(orderExpr, a, evalFn));
      const vb = toNumber(evalUnit(orderExpr, b, evalFn));
      return va - vb;
    });
  } else {
    units = shuffle([...units]);
  }

  // 3. Apply grouping expression if set
  if (config.grouping) {
    const groupExpr = config.grouping;
    const groupMap = new Map<string, number[]>();
    for (const unit of units) {
      const key = String(evalUnit(groupExpr, unit, evalFn) ?? '');
      const group = groupMap.get(key) ?? [];
      group.push(unit.id);
      groupMap.set(key, group);
    }
    return [...groupMap.values()].map((unitIds) => ({ units: unitIds }));
  }

  // 4. Sequential grouping by assignment size
  const assignment = config.assignment;
  if (assignment === undefined || assignment === 'dynamic') {
    // Deferred — can't group yet
    return { kind: 'deferred', orderedUnitIds: units.map((u) => u.id) };
  }
  if (assignment === 'admin') {
    return { kind: 'deferred', orderedUnitIds: units.map((u) => u.id) };
  }

  const groupSize = assignment as number;
  const groups: MatchGroup[] = [];
  for (let i = 0; i < units.length; i += groupSize) {
    groups.push({ units: units.slice(i, i + groupSize).map((u) => u.id) });
  }
  return groups;
}
