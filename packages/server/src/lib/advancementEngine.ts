import type { AdminSentinel, ScoringUnitSnapshot, SectionSnapshot, EventSnapshot } from '@hanabi/dsl';
import { evalExpr } from '@hanabi/dsl/src/runtimeExpr/evaluator.js';
import { parseExpr } from '@hanabi/dsl/src/runtimeExpr/parser.js';
import type { DB } from '../db/index.js';
import { advancementDecisions, adminInputs } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

type EvalFn = typeof evalExpr;

// ---------------------------------------------------------------------------
// computeAdvancementPure — no DB, testable
// ---------------------------------------------------------------------------

export interface AdvancementResult {
  unitType: string;
  unitId: number;
  advances: boolean;
}

/**
 * Evaluate the advancement predicate for each unit.
 * Returns one result per unit.
 */
export function computeAdvancementPure(
  advancementExpr: string,
  units: ScoringUnitSnapshot[],
  sectionSnapshot: SectionSnapshot,
  eventSnapshot: EventSnapshot,
  evalFn: EvalFn,
): AdvancementResult[] {
  const parsed = parseExpr(advancementExpr);

  return units.map((unit) => {
    if (!parsed.ok) {
      return { unitType: unit.type, unitId: unit.id, advances: false };
    }

    const ctx = {
      unit,
      section: sectionSnapshot,
      event: eventSnapshot,
    } as unknown as Parameters<EvalFn>[1];

    const result = evalFn(parsed.node, ctx);
    const advances = result.ok ? Boolean(result.value) : false;

    return { unitType: unit.type, unitId: unit.id, advances };
  });
}

// ---------------------------------------------------------------------------
// computeAdvancement — with DB for admin inputs + result storage
// ---------------------------------------------------------------------------

export async function computeAdvancement(
  sectionId: number,
  advancementExpr: string | AdminSentinel,
  evalFn: EvalFn,
  db: DB,
  units?: ScoringUnitSnapshot[],
  sectionSnapshot?: SectionSnapshot,
  eventSnapshot?: EventSnapshot,
): Promise<AdvancementResult[]> {
  // Admin: read from admin_inputs table
  if (advancementExpr === 'admin') {
    const inputs = await db
      .select({ value: adminInputs.value, unitId: adminInputs.fieldPath })
      .from(adminInputs)
      .where(
        and(
          eq(adminInputs.sectionId, sectionId),
          eq(adminInputs.fieldPath, 'advancement'),
        ),
      )
      .limit(10000);

    // admin_inputs stores unitId in value field as JSON
    return inputs.map((inp) => {
      const val = inp.value as { unitType: string; unitId: number; advances: boolean };
      return {
        unitType: val.unitType ?? 'individual',
        unitId: val.unitId ?? 0,
        advances: Boolean(val.advances),
      };
    });
  }

  // Non-admin: evaluate predicate per unit
  const snapshotUnits = units ?? [];
  const section = sectionSnapshot ?? {
    name: '',
    status: 'published' as const,
    time_window: {},
    results: snapshotUnits,
  };
  const event = eventSnapshot ?? {
    slug: '',
    name: '',
    status: 'published' as const,
    sections: {},
  };

  const results = computeAdvancementPure(advancementExpr, snapshotUnits, section, event, evalFn);

  // Persist to advancement_decisions (upsert)
  if (results.length > 0) {
    for (const r of results) {
      await db
        .insert(advancementDecisions)
        .values({
          sectionId,
          unitType: r.unitType,
          unitId: r.unitId,
          advances: r.advances,
          decidedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [advancementDecisions.sectionId, advancementDecisions.unitType, advancementDecisions.unitId],
          set: { advances: true, decidedAt: new Date() }, // Drizzle requires a set value
        });
    }
  }

  return results;
}
