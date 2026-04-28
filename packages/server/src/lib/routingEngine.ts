import type { RoutingBlock, RoutingRule } from '@hanabi/dsl';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoutingDecision {
  unitId: number;
  outcome:
    | { kind: 'proceeds_to'; targetSection: string }
    | { kind: 'eliminated'; exitRound: string }
    | { kind: 'assigned_to'; targetSection: string; position: number }
    | { kind: 'assigned_rank'; rank: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a routing block key to extract the rank range it applies to.
 * Keys can be like "rank_1", "rank_2", "rank_1-4", or "default".
 * Returns a predicate function over rank.
 */
function matchesRank(key: string, rank: number): boolean {
  if (key === 'default') return true;

  // "rank_1" → exact rank
  const exactMatch = /^rank_(\d+)$/.exec(key);
  if (exactMatch) return rank === parseInt(exactMatch[1]!, 10);

  // "rank_1-4" → range
  const rangeMatch = /^rank_(\d+)-(\d+)$/.exec(key);
  if (rangeMatch) {
    const lo = parseInt(rangeMatch[1]!, 10);
    const hi = parseInt(rangeMatch[2]!, 10);
    return rank >= lo && rank <= hi;
  }

  return false;
}

function resolveRule(
  rule: RoutingRule,
  unitId: number,
  rank: number,
  sectionName: string,
): RoutingDecision | null {
  if ('when' in rule) {
    // Conditional rule — for simplicity, evaluate when as always-true (full eval via evalExpr not wired here)
    // The caller may pass pre-evaluated results
    const innerDecision = rule.proceeds_to
      ? ({ unitId, outcome: { kind: 'proceeds_to', targetSection: rule.proceeds_to } } as RoutingDecision)
      : rule.assigned_rank !== undefined
        ? ({ unitId, outcome: { kind: 'assigned_rank', rank: Number(rule.assigned_rank) } } as RoutingDecision)
        : null;
    return innerDecision;
  }

  if ('proceeds_to' in rule) {
    return { unitId, outcome: { kind: 'proceeds_to', targetSection: rule.proceeds_to } };
  }

  if ('eliminated' in rule && rule.eliminated) {
    return { unitId, outcome: { kind: 'eliminated', exitRound: sectionName } };
  }

  if ('assigned_to' in rule) {
    return {
      unitId,
      outcome: {
        kind: 'assigned_to',
        targetSection: rule.assigned_to.section,
        position: parseInt(String(rule.assigned_to.position), 10) || 0,
      },
    };
  }

  if ('assigned_rank' in rule) {
    return {
      unitId,
      outcome: { kind: 'assigned_rank', rank: Number(rule.assigned_rank) },
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// applyRouting
// ---------------------------------------------------------------------------

/**
 * Apply routing rules to a ranked list of units.
 * Returns one RoutingDecision per unit.
 */
export function applyRouting(
  routing: RoutingBlock,
  matchResults: Array<{ rank: number; unitId: number }>,
  sectionName: string,
): RoutingDecision[] {
  const decisions: RoutingDecision[] = [];

  for (const { rank, unitId } of matchResults) {
    // Find the first routing key that matches this rank
    let matched = false;
    for (const [key, rule] of Object.entries(routing)) {
      if (matchesRank(key, rank)) {
        const decision = resolveRule(rule, unitId, rank, sectionName);
        if (decision) {
          decisions.push(decision);
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      // No rule matched — default to eliminated
      decisions.push({
        unitId,
        outcome: { kind: 'eliminated', exitRound: sectionName },
      });
    }
  }

  return decisions;
}
