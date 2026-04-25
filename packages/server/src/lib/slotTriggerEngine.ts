import { and, eq, gt } from 'drizzle-orm';
import type { DB } from '../db/index.js';
import { slots, deferredSlotGenerators, gameSpecs } from '../db/schema.js';
import { issueSpec } from '@hanabi/dsl/src/seedEngine.js';

/**
 * Called when a slot is completed (a game is recorded for it).
 * If the slot has lazy_trigger: 'completion', issues the next slot in sequence.
 */
export async function onSlotCompleted(slotId: number, db: DB): Promise<void> {
  const [completedSlot] = await db.select().from(slots).where(eq(slots.id, slotId)).limit(1);
  if (!completedSlot) return;

  // Find the next pending lazy slot with lazy_trigger: 'completion' in the same section
  const [nextSlot] = await db
    .select()
    .from(slots)
    .where(
      and(
        eq(slots.sectionId, completedSlot.sectionId),
        eq(slots.assignmentTrigger, 'lazy'),
        eq(slots.lazyTrigger, 'completion'),
        eq(slots.status, 'pending'),
        gt(slots.slotIndex, completedSlot.slotIndex),
      ),
    )
    .orderBy(slots.slotIndex)
    .limit(1);

  if (!nextSlot) return;

  const config = nextSlot.config as { seed_pattern?: string };
  const seedPattern = config.seed_pattern ?? '';
  const spec = issueSpec(
    seedPattern,
    { sectionID: completedSlot.sectionId, slotIndex: nextSlot.slotIndex },
    [],
  );

  await db.insert(gameSpecs).values({
    specString: spec,
    sectionId: completedSlot.sectionId,
    slotId: nextSlot.id,
    slotIndex: nextSlot.slotIndex,
  });

  await db.update(slots).set({ status: 'issued' }).where(eq(slots.id, nextSlot.id));
}

/**
 * Called when an organiser manually triggers a lazy slot via admin input.
 * Issues the next slot for lazy_trigger: 'admin' slots, or a new slot from
 * an admin_sequence DeferredSlotGenerator.
 *
 * V1: lazy_trigger: 'action' is treated identically to 'admin'.
 * See docs/decisions/deferred.md for the rationale.
 */
export async function onAdminTrigger(
  sectionId: number,
  fieldPath: string,
  db: DB,
): Promise<void> {
  // admin_sequence generator: fieldPath ends with 'sequence.count'
  if (fieldPath === 'sequence.count' || fieldPath.endsWith('.sequence.count')) {
    const [generator] = await db
      .select()
      .from(deferredSlotGenerators)
      .where(
        and(
          eq(deferredSlotGenerators.sectionId, sectionId),
          eq(deferredSlotGenerators.triggerType, 'admin_sequence'),
        ),
      )
      .limit(1);
    if (!generator) return;

    await _issueFromGenerator(generator, sectionId, db);
    return;
  }

  // lazy_trigger: 'admin' or 'action' (V1: treated identically)
  const [nextSlot] = await db
    .select()
    .from(slots)
    .where(
      and(
        eq(slots.sectionId, sectionId),
        eq(slots.lazyTrigger, 'admin'),
        eq(slots.status, 'pending'),
      ),
    )
    .orderBy(slots.slotIndex)
    .limit(1);

  if (!nextSlot) return;

  const config = nextSlot.config as { seed_pattern?: string };
  const seedPattern = config.seed_pattern ?? '';
  const spec = issueSpec(
    seedPattern,
    { sectionID: sectionId, slotIndex: nextSlot.slotIndex },
    [],
  );

  await db.insert(gameSpecs).values({
    specString: spec,
    sectionId,
    slotId: nextSlot.id,
    slotIndex: nextSlot.slotIndex,
  });

  await db.update(slots).set({ status: 'issued' }).where(eq(slots.id, nextSlot.id));
}

/**
 * Called when a new attempt begins on a slot with on_trigger: attempt_start.
 * Issues a new slot from the DeferredSlotGenerator.
 */
export async function onAttemptStart(slotId: number, unitId: number, db: DB): Promise<void> {
  const [triggeringSlot] = await db.select().from(slots).where(eq(slots.id, slotId)).limit(1);
  if (!triggeringSlot) return;

  const [generator] = await db
    .select()
    .from(deferredSlotGenerators)
    .where(
      and(
        eq(deferredSlotGenerators.sectionId, triggeringSlot.sectionId),
        eq(deferredSlotGenerators.triggerType, 'attempt_start'),
      ),
    )
    .limit(1);
  if (!generator) return;

  await _issueFromGenerator(generator, triggeringSlot.sectionId, db, unitId);
}

/**
 * Called when a bracket section activates (matchup is assembled).
 * Issues slots from DeferredSlotGenerator with trigger_type: bracket_activation.
 */
export async function onBracketActivation(
  sectionId: number,
  matchupUnits: number[],
  db: DB,
): Promise<void> {
  const [generator] = await db
    .select()
    .from(deferredSlotGenerators)
    .where(
      and(
        eq(deferredSlotGenerators.sectionId, sectionId),
        eq(deferredSlotGenerators.triggerType, 'bracket_activation'),
      ),
    )
    .limit(1);
  if (!generator) return;

  for (const teamID of matchupUnits) {
    await _issueFromGenerator(generator, sectionId, db, teamID);
  }
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

async function _issueFromGenerator(
  generator: typeof deferredSlotGenerators.$inferSelect,
  sectionId: number,
  db: DB,
  teamID?: number,
): Promise<void> {
  const existingSlots = await db
    .select({ id: slots.id })
    .from(slots)
    .where(eq(slots.sectionId, sectionId))
    .limit(100000);

  const nextSlotIndex = existingSlots.length;
  const config = generator.generatorConfig as { seed_pattern?: string };
  const seedPattern = config.seed_pattern ?? '';
  const spec = issueSpec(
    seedPattern,
    { sectionID: sectionId, slotIndex: nextSlotIndex, teamID },
    [],
  );

  const [newSlot] = await db
    .insert(slots)
    .values({
      sectionId,
      slotIndex: nextSlotIndex,
      assignmentTrigger: 'lazy',
      status: 'issued',
      config: generator.generatorConfig as Record<string, unknown>,
    })
    .returning({ id: slots.id });

  await db.insert(gameSpecs).values({
    specString: spec,
    sectionId,
    slotId: newSlot.id,
    slotIndex: nextSlotIndex,
  });
}
