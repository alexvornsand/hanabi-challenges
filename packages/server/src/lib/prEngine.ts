import type { PromotionRelegation } from '@hanabi/dsl';
import { evaluateCompileTime } from '@hanabi/dsl/src/compileTimeEval.js';
import type { DB } from '../db/index.js';
import { divisionAssignments, registrations, speculativePrResults } from '../db/schema.js';
import { eq, and, inArray, notInArray } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PRResult {
  unitType: 'individual' | 'team';
  unitId: number;
  currentDivision: string;
  nextDivision: string;
  status: 'promoted' | 'relegated' | 'stayed' | 'absent' | 'overflow';
}

interface DivisionStanding {
  division: string;
  units: Array<{ unitType: 'individual' | 'team'; unitId: number; rank: number }>;
}

// ---------------------------------------------------------------------------
// evaluateDivisionCount — pure
// ---------------------------------------------------------------------------

export function evaluateDivisionCount(
  expr: string | number,
  registrantCount: number,
  priorDivisionCount: number,
): number {
  if (typeof expr === 'number') return expr;
  const result = evaluateCompileTime(expr, {
    registrant_count: registrantCount,
    prior_division_count: priorDivisionCount,
  });
  if (result.ok && typeof result.value === 'number') {
    return Math.max(1, Math.ceil(result.value));
  }
  return priorDivisionCount;
}

// ---------------------------------------------------------------------------
// Carry-balanced algorithm — pure
// ---------------------------------------------------------------------------

export interface CarryResult {
  unitType: 'individual' | 'team';
  unitId: number;
  currentDivision: string;
  nextDivision: string;
  status: 'promoted' | 'relegated' | 'stayed';
}

export function computeCarryBalanced(
  config: PromotionRelegation,
  standings: DivisionStanding[],
): CarryResult[] {
  const { standard_promotions, standard_relegations, clamp = false } = config;
  const standardPromotions = typeof standard_promotions === 'number' ? standard_promotions : 0;
  const standardRelegations = typeof standard_relegations === 'number' ? standard_relegations : 0;

  // Sort divisions by name (convention: top division first)
  const sortedDivisions = [...standings].sort((a, b) => a.division.localeCompare(b.division));

  const results: CarryResult[] = [];
  let carryIn = 0;

  for (let i = 0; i < sortedDivisions.length; i++) {
    const div = sortedDivisions[i]!;
    const actualSize = div.units.length;
    const targetSize = config.target_size;

    const actualPromotions = clamp
      ? Math.max(0, Math.min(standardPromotions, actualSize))
      : standardPromotions;
    const actualRelegations = standardRelegations + carryIn;
    carryIn = carryIn + (actualPromotions - standardPromotions);

    // Sort units by rank
    const sorted = [...div.units].sort((a, b) => a.rank - b.rank);

    for (let j = 0; j < sorted.length; j++) {
      const unit = sorted[j]!;
      const rankFromTop = j + 1;
      const rankFromBottom = sorted.length - j;

      let status: 'promoted' | 'relegated' | 'stayed' = 'stayed';
      let nextDivision = div.division;

      if (rankFromTop <= actualPromotions && i > 0) {
        status = 'promoted';
        nextDivision = sortedDivisions[i - 1]!.division;
      } else if (rankFromBottom <= actualRelegations && i < sortedDivisions.length - 1) {
        status = 'relegated';
        nextDivision = sortedDivisions[i + 1]!.division;
      }

      results.push({
        unitType: unit.unitType,
        unitId: unit.unitId,
        currentDivision: div.division,
        nextDivision,
        status,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// invalidateSpeculativePR
// ---------------------------------------------------------------------------

export async function invalidateSpeculativePR(eventId: number, db: DB): Promise<void> {
  await db.delete(speculativePrResults).where(eq(speculativePrResults.sectionId, eventId));
}

// ---------------------------------------------------------------------------
// computePromotion / computeSpeculativePR
// ---------------------------------------------------------------------------

/**
 * Shared logic for computing P/R results.
 * In V1 this is a simplified version that works from division_assignments.
 */
async function computePRInternal(
  eventId: number,
  dimensionAxis: string,
  prConfig: PromotionRelegation,
  db: DB,
  _speculative: boolean,
): Promise<PRResult[]> {
  // Load current division assignments for this event
  const assignments = await db
    .select()
    .from(divisionAssignments)
    .where(
      and(
        eq(divisionAssignments.eventId, eventId),
        eq(divisionAssignments.dimensionAxis, dimensionAxis),
      ),
    )
    .limit(10000);

  if (assignments.length === 0) return [];

  // Load registrations to detect absent units
  const registeredUnitIds = await db
    .select({ unitId: registrations.unitId, unitType: registrations.unitType })
    .from(registrations)
    .where(eq(registrations.eventId, eventId))
    .limit(10000);

  const registeredKeys = new Set(registeredUnitIds.map((r) => `${r.unitType}:${r.unitId}`));

  const results: PRResult[] = [];

  for (const assignment of assignments) {
    const key = `${assignment.unitType}:${assignment.unitId}`;
    if (!registeredKeys.has(key)) {
      // Absent unit — stays in current division, absence_events tracked elsewhere
      results.push({
        unitType: assignment.unitType as 'individual' | 'team',
        unitId: assignment.unitId,
        currentDivision: assignment.divisionValue,
        nextDivision: assignment.divisionValue,
        status: 'absent',
      });
    } else {
      // Present — stub: stayed (full sorting requires scoreboard engine integration)
      results.push({
        unitType: assignment.unitType as 'individual' | 'team',
        unitId: assignment.unitId,
        currentDivision: assignment.divisionValue,
        nextDivision: assignment.divisionValue,
        status: 'stayed',
      });
    }
  }

  return results;
}

export async function computePromotion(
  eventId: number,
  dimensionAxis: string,
  prConfig: PromotionRelegation,
  db: DB,
): Promise<PRResult[]> {
  return computePRInternal(eventId, dimensionAxis, prConfig, db, false);
}

export async function computeSpeculativePR(
  eventId: number,
  dimensionAxis: string,
  prConfig: PromotionRelegation,
  db: DB,
): Promise<PRResult[]> {
  return computePRInternal(eventId, dimensionAxis, prConfig, db, true);
}
