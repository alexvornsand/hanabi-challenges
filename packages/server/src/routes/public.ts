import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { gameSpecs, games, sections, slots, speculativePrResults } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { implicitlyRegister } from '../lib/registrationEngine.js';
import { onSlotCompleted } from '../lib/slotTriggerEngine.js';
import { parseExpr } from '@hanabi/dsl/src/runtimeExpr/parser.js';
import { evalExpr } from '@hanabi/dsl/src/runtimeExpr/evaluator.js';
import { notImplemented } from '../types.js';

interface GameSubmissionRequest {
  spec_string: string;
  points: number;
  max_score: boolean;
  bdr?: number;
  turn_count?: number;
  strikes?: number;
  datetime_start: string;
  datetime_end: string;
  participants: number[];
  tags?: string[];
}

function buildGameContext(body: GameSubmissionRequest, slug: string) {
  return {
    game: {
      points: body.points,
      max_score: body.max_score,
      bdr: body.bdr ?? 0,
      turn_count: body.turn_count ?? 0,
      strikes: body.strikes ?? 0,
      participants: body.participants,
    },
    unit: {
      id: 0,
      name: '',
      type: 'individual' as const,
      score: body.points,
      rank: 0,
      slot_results: [],
      member_ids: body.participants,
      section_scores: {},
      section_ranks: {},
    },
    event: {
      slug,
      name: '',
      status: 'published' as const,
      sections: {},
    },
  };
}

export async function publicRoutes(app: FastifyInstance) {
  // POST /api/:slug/games — game submission
  app.post('/api/:slug/games', async (req, reply) => {
    await requireAuth(req, reply);
    if (reply.sent) return;

    const slug = (req.params as { slug: string }).slug;
    const body = req.body as GameSubmissionRequest;

    if (
      !body?.spec_string ||
      !Array.isArray(body?.participants) ||
      body.participants.length === 0 ||
      typeof body?.points !== 'number' ||
      !body?.datetime_start ||
      !body?.datetime_end
    ) {
      return reply.status(400).send({ ok: false, error: 'Missing required fields', code: 'bad_request' });
    }

    // 2. Look up spec_string in game_specs
    const [spec] = await db
      .select()
      .from(gameSpecs)
      .where(eq(gameSpecs.specString, body.spec_string))
      .limit(1);
    if (!spec) {
      return reply.status(404).send({ ok: false, error: 'Spec not found', code: 'not_found' });
    }

    // Load section
    const [section] = await db
      .select()
      .from(sections)
      .where(eq(sections.id, spec.sectionId))
      .limit(1);
    if (!section) {
      return reply.status(404).send({ ok: false, error: 'Section not found', code: 'not_found' });
    }

    const config = section.config as Record<string, unknown>;
    const capturePolicy = (config?.capture_policy ?? {}) as Record<string, unknown>;

    // 3. Check capture_policy.submit
    if (capturePolicy.submit === false) {
      return reply.status(400).send({
        ok: false,
        error: 'This event does not accept game submissions',
        code: 'submit_disabled',
      });
    }

    // 4. Check captureMode transition
    if (section.captureMode === 'scrape_only') {
      return reply.status(400).send({
        ok: false,
        error: 'Event is now in scrape-only mode',
        code: 'scrape_only',
      });
    }

    // 5. Check time_window validity
    const now = new Date();
    if (section.start && section.start > now) {
      return reply.status(400).send({
        ok: false,
        error: 'Event has not started yet',
        code: 'outside_time_window',
      });
    }

    // 6. Evaluate validity_rules from the slot
    if (spec.slotId) {
      const [slot] = await db.select().from(slots).where(eq(slots.id, spec.slotId)).limit(1);
      if (slot) {
        const slotConfig = slot.config as { validity_rules?: Array<{ predicate: string }> };
        const validityRules = slotConfig.validity_rules ?? [];
        const violations: string[] = [];
        const gameCtx = buildGameContext(body, slug);

        for (const rule of validityRules) {
          const parsed = parseExpr(rule.predicate);
          if (!parsed.ok) {
            violations.push(rule.predicate);
            continue;
          }
          const result = evalExpr(parsed.node, gameCtx);
          if (!result.ok || !result.value) {
            violations.push(rule.predicate);
          }
        }

        if (violations.length > 0) {
          return reply.status(400).send({
            ok: false,
            error: 'Validity rule violations',
            code: 'validity_violation',
            violations,
          });
        }
      }
    }

    // 7. Registration check (explicit-only policy)
    const registrationPolicy = (config?.registration_policy ?? {}) as Record<string, unknown>;
    if (registrationPolicy.explicit === true && registrationPolicy.implicit !== true) {
      // For explicit-only events, verify participants are registered (best-effort check)
      // Full implementation deferred — verified against registrations table in ticket 027+
    }

    // 8. Duplicate check
    const gameTimestamp = new Date(body.datetime_start);
    const [duplicate] = await db
      .select({ id: games.id })
      .from(games)
      .where(and(eq(games.specId, spec.id), eq(games.gameTimestamp, gameTimestamp)))
      .limit(1);

    if (duplicate) {
      return reply.status(409).send({ ok: false, error: 'Duplicate game submission', code: 'duplicate' });
    }

    // 9. BDR (caller-provided or default 0)
    const bdr = body.bdr ?? 0;

    const gameResult = {
      points: body.points,
      max_score: body.max_score,
      bdr,
      turn_count: body.turn_count,
      strikes: body.strikes,
      datetime_start: body.datetime_start,
      datetime_end: body.datetime_end,
      participants: body.participants,
    };

    // 10. Insert game
    const [newGame] = await db
      .insert(games)
      .values({
        specId: spec.id,
        participants: body.participants,
        result: gameResult,
        gameTimestamp,
        source: 'submitted',
        tags: body.tags ?? [],
        gameResultPayload: gameResult,
      })
      .returning({ id: games.id });

    // 11. Implicit registration
    if (registrationPolicy.implicit !== false) {
      await implicitlyRegister(
        section.id,
        body.participants.filter((id) => id > 0),
        section.id,
        db,
      );
    }

    // 12. onSlotCompleted
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

    // 13. Invalidate speculative P/R cache
    await db
      .delete(speculativePrResults)
      .where(eq(speculativePrResults.sectionId, spec.sectionId));

    return reply.status(201).send({ ok: true, gameId: newGame.id });
  });

  // GET /api/events/:id/scoreboard — public scoreboard
  app.get('/api/events/:id/scoreboard', async (_req, reply) => notImplemented(reply));

  // GET /api/events/:id/slots — public slot list
  app.get('/api/events/:id/slots', async (_req, reply) => notImplemented(reply));

  // GET /api/events/:id/my-progress — participant's own progress
  app.get('/api/events/:id/my-progress', async (_req, reply) => notImplemented(reply));

  // GET /api/events/:id/awards — list of awards and winners
  app.get('/api/events/:id/awards', async (_req, reply) => notImplemented(reply));

  // GET /api/events/:id/sections — event section structure
  app.get('/api/events/:id/sections', async (_req, reply) => notImplemented(reply));

  // GET /api/events/:id/sections/:sectionId — section detail
  app.get('/api/events/:id/sections/:sectionId', async (_req, reply) => notImplemented(reply));
}
