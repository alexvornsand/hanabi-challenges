import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import type { DB } from '../db/index.js';
import {
  gameSpecs,
  games,
  sections,
  slots,
  speculativePrResults,
  variantRegistry,
} from '../db/schema.js';
import { createHLiveClient } from '../lib/hliveClient.js';
import { implicitlyRegister } from '../lib/registrationEngine.js';
import { onSlotCompleted } from '../lib/slotTriggerEngine.js';

// ---------------------------------------------------------------------------
// BDR calculation
// BDR = score / maxPossibleScore (variant max, or 25 as a safe default)
// ---------------------------------------------------------------------------
function computeBDR(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.round((score / maxScore) * 10000) / 10000; // 4 decimal places
}

// ---------------------------------------------------------------------------
// scrapeGames
// ---------------------------------------------------------------------------

export async function scrapeGames(db: DB): Promise<{ inserted: number; skipped: number }> {
  const client = createHLiveClient();
  let inserted = 0;
  let skipped = 0;

  // 1. Load all game_specs for published events with scrape capture mode
  const specRows = await db
    .select({
      specId: gameSpecs.id,
      specString: gameSpecs.specString,
      sectionId: gameSpecs.sectionId,
      slotId: gameSpecs.slotId,
      slotIndex: gameSpecs.slotIndex,
    })
    .from(gameSpecs)
    .limit(100000);

  if (specRows.length === 0) return { inserted, skipped };

  // Load relevant sections (published, scrape-enabled)
  const sectionIds = [...new Set(specRows.map((r) => r.sectionId))];
  const sectionRows = await db
    .select()
    .from(sections)
    .where(
      and(
        inArray(sections.id, sectionIds),
        eq(sections.status, 'published'),
        or(eq(sections.captureMode, 'both'), eq(sections.captureMode, 'scrape_only')),
      ),
    )
    .limit(10000);

  const sectionMap = new Map(sectionRows.map((s) => [s.id, s]));

  // Load variant registry for BDR calculation
  const variantRows = await db.select().from(variantRegistry).limit(10000);
  const variantMap = new Map(variantRows.map((v) => [v.variantId, v]));

  // Filter specs to scrape-enabled published sections
  const scrapableSpecs = specRows.filter((s) => sectionMap.has(s.sectionId));

  const now = new Date();

  for (const spec of scrapableSpecs) {
    const section = sectionMap.get(spec.sectionId)!;

    // 2. Check capture_policy.transition (evaluate against section config)
    const config = section.config as Record<string, unknown>;
    const capturePolicy = config?.capture_policy as Record<string, unknown> | undefined;
    const transitionExpr = capturePolicy?.transition as string | undefined;
    if (transitionExpr === 'true') {
      // Transition has fired — switch to submit_only if not already
      if (section.captureMode !== 'submit_only') {
        await db
          .update(sections)
          .set({ captureMode: 'submit_only' })
          .where(eq(sections.id, section.id));
      }
      skipped++;
      continue;
    }

    // 3. Check time_window validity
    if (section.start && section.start > now) {
      skipped++;
      continue;
    }

    // 4. Fetch games from h-live
    let hliveGames;
    try {
      hliveGames = await client.getGamesBySeed(spec.specString);
    } catch {
      skipped++;
      continue;
    }

    for (const game of hliveGames) {
      const gameTimestamp = new Date(game.datetime_started);

      // 5. Duplicate check: same specId + gameTimestamp
      const existing = await db
        .select({ id: games.id })
        .from(games)
        .where(and(eq(games.specId, spec.specId), eq(games.gameTimestamp, gameTimestamp)))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // 6. Compute BDR
      const variant = variantMap.get(game.variant_id);
      const maxScore = variant?.maxScore ?? 25;
      const bdr = computeBDR(game.score, maxScore);

      const participants = game.players.map((p) => p.user_id);

      const gameResult = {
        points: game.score,
        max_score: game.score === maxScore,
        bdr,
        turn_count: game.turns,
        datetime_start: game.datetime_started,
        datetime_end: game.datetime_finished,
        end_condition: game.end_condition,
        participants,
      };

      // 7. Insert game
      await db.insert(games).values({
        specId: spec.specId,
        participants,
        result: gameResult,
        gameTimestamp,
        source: 'scraped',
        tags: game.tags,
        gameResultPayload: gameResult,
      });

      inserted++;

      // 8. Implicit registration
      const registrationPolicy = config?.registration_policy as Record<string, unknown> | undefined;
      if (registrationPolicy?.implicit !== false) {
        await implicitlyRegister(
          section.id,
          participants.filter((id) => id > 0),
          section.id,
          db,
        );
      }

      // 9. Lazy slot trigger on completion
      if (spec.slotId) {
        const [slotRow] = await db
          .select({ lazyTrigger: slots.lazyTrigger })
          .from(slots)
          .where(eq(slots.id, spec.slotId))
          .limit(1);

        if (slotRow?.lazyTrigger === 'completion') {
          await onSlotCompleted(spec.slotId, db);
        }
      }

      // 10. Invalidate speculative PR results
      await db
        .delete(speculativePrResults)
        .where(eq(speculativePrResults.sectionId, spec.sectionId));
    }
  }

  return { inserted, skipped };
}
