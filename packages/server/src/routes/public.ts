import type { FastifyInstance } from 'fastify';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { gameSpecs, games, sections, slots, speculativePrResults, registrations, awardIssuances, awards as awardsTable } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { implicitlyRegister } from '../lib/registrationEngine.js';
import { onSlotCompleted } from '../lib/slotTriggerEngine.js';
import { parseExpr } from '@hanabi/dsl/src/runtimeExpr/parser.js';
import { evalExpr } from '@hanabi/dsl/src/runtimeExpr/evaluator.js';
import { notImplemented } from '../types.js';
import { runPipeline } from '@hanabi/dsl/src/pipeline.js';
import { computeScoreboardFromData } from '../lib/scoreboardEngine.js';
import { evaluateResultsVisible, evaluateSpecsVisible } from '../lib/visibilityEngine.js';
import type { ScoringUnitSnapshot, SlotResultSnapshot, GameResult } from '@hanabi/dsl';

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

    return reply.status(201).send({ ok: true, gameId: newGame!.id });
  });

  // DEFERRED: see docs/decisions/deferred.md#id-based-public-event-routes
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

  // ---------------------------------------------------------------------------
  // Slug-based public routes (T043)
  // ---------------------------------------------------------------------------

  // Helper: load event by slug, run pipeline, build unit snapshots
  async function loadEventBySlug(slug: string) {
    const [event] = await db
      .select()
      .from(sections)
      .where(and(eq(sections.slug, slug), eq(sections.status, 'published')))
      .limit(1);
    return event ?? null;
  }

  async function buildUnitSnapshots(eventId: number) {
    const regs = await db
      .select()
      .from(registrations)
      .where(eq(registrations.eventId, eventId))
      .limit(10000);

    const eventSlots = await db
      .select()
      .from(slots)
      .where(eq(slots.sectionId, eventId))
      .limit(10000);

    const slotIds = eventSlots.map((s) => s.id);
    const specs = slotIds.length > 0
      ? await db.select().from(gameSpecs).where(inArray(gameSpecs.slotId, slotIds)).limit(100000)
      : [];

    const specIds = specs.map((s) => s.id);
    const allGames = specIds.length > 0
      ? await db.select().from(games).where(inArray(games.specId, specIds)).limit(100000)
      : [];

    const gamesBySpec = new Map<number, typeof allGames>();
    for (const g of allGames) {
      const arr = gamesBySpec.get(g.specId) ?? [];
      arr.push(g);
      gamesBySpec.set(g.specId, arr);
    }

    return regs.map((reg): ScoringUnitSnapshot => {
      const slotResults: SlotResultSnapshot[] = eventSlots.map((slot) => {
        const slotSpecs = specs.filter((s) => s.slotId === slot.id);
        const slotGames: GameResult[] = [];
        let slotScore = 0;
        for (const spec of slotSpecs) {
          const specGames = (gamesBySpec.get(spec.id) ?? []).filter(
            (g) => (g.participants as number[]).includes(reg.unitId),
          );
          for (const g of specGames) {
            const payload = g.gameResultPayload as Record<string, unknown>;
            const gr: GameResult = {
              points: (payload.points as number) ?? 0,
              max_score: Boolean(payload.max_score),
              participants: g.participants as number[],
              source: g.source as 'scraped' | 'submitted',
              tags: g.tags as string[],
            };
            slotGames.push(gr);
            slotScore = Math.max(slotScore, gr.points);
          }
        }
        return { slot_index: slot.slotIndex, score: slotScore, games: slotGames };
      });

      const score = slotResults.reduce((sum, sr) => sum + sr.score, 0);

      return {
        id: reg.unitId,
        name: `unit:${reg.unitId}`,
        type: reg.unitType as 'individual' | 'team',
        score,
        rank: 0,
        slot_results: slotResults,
        section_scores: {},
        section_ranks: {},
        member_ids: [],
      };
    });
  }

  // GET /api/:slug — event overview + primary scoreboard
  app.get('/api/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const event = await loadEventBySlug(slug);
    if (!event) return reply.status(404).send({ ok: false, error: 'Not found', code: 'not_found' });

    const yaml = (event.config as Record<string, unknown>)?.yaml as string ?? '';
    const pipeline = await runPipeline(yaml, new Map());
    if (!pipeline.expandedConfig) {
      return reply.status(500).send({ ok: false, error: 'Config error', code: 'config_error' });
    }

    const scoreboards = pipeline.expandedConfig.root.scoreboards ?? [];
    return reply.send({
      id: event.id,
      name: event.name,
      slug: event.slug,
      status: event.status,
      scoreboards: scoreboards.map((sb) => ({ name: sb.name, primary: sb.primary, featured: true })),
    });
  });

  // GET /api/:slug/scoreboards — all featured scoreboards
  app.get('/api/:slug/scoreboards', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const event = await loadEventBySlug(slug);
    if (!event) return reply.status(404).send({ ok: false, error: 'Not found', code: 'not_found' });

    const yaml = (event.config as Record<string, unknown>)?.yaml as string ?? '';
    const pipeline = await runPipeline(yaml, new Map());
    if (!pipeline.expandedConfig) return reply.send({ scoreboards: [] });

    const units = await buildUnitSnapshots(event.id);
    const scoreboards = pipeline.expandedConfig.root.scoreboards ?? [];
    const featured = scoreboards.filter((sb) => {
      const result = computeScoreboardFromData(sb, pipeline.expandedConfig!, { units });
      return result.featured;
    });

    return reply.send({
      scoreboards: featured.map((sb) => ({ name: sb.name, primary: sb.primary ?? false, featured: true })),
    });
  });

  // GET /api/:slug/standings — primary scoreboard
  app.get('/api/:slug/standings', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const event = await loadEventBySlug(slug);
    if (!event) return reply.status(404).send({ ok: false, error: 'Not found', code: 'not_found' });

    const yaml = (event.config as Record<string, unknown>)?.yaml as string ?? '';
    const pipeline = await runPipeline(yaml, new Map());
    if (!pipeline.expandedConfig) return reply.send({ rows: [], hidden: false });

    // Check visibility
    const visPolicy = pipeline.expandedConfig.root.visibility_policy ?? {};
    const eventSnapshot = { slug: event.slug ?? '', name: event.name, status: event.status as 'draft' | 'published' | 'closed', sections: {} };
    if (!evaluateResultsVisible(visPolicy, eventSnapshot)) {
      return reply.send({ rows: [], hidden: true });
    }

    const scoreboards = pipeline.expandedConfig.root.scoreboards ?? [];
    const primary = scoreboards.find((sb) => sb.primary) ?? scoreboards[0];
    if (!primary) return reply.send({ rows: [] });

    const units = await buildUnitSnapshots(event.id);
    const result = computeScoreboardFromData(primary, pipeline.expandedConfig, { units });

    return reply.send(result);
  });

  // GET /api/:slug/standings/:name — named scoreboard
  app.get('/api/:slug/standings/:name', async (req, reply) => {
    const { slug, name } = req.params as { slug: string; name: string };
    const event = await loadEventBySlug(slug);
    if (!event) return reply.status(404).send({ ok: false, error: 'Not found', code: 'not_found' });

    const yaml = (event.config as Record<string, unknown>)?.yaml as string ?? '';
    const pipeline = await runPipeline(yaml, new Map());
    if (!pipeline.expandedConfig) return reply.status(404).send({ ok: false, error: 'Not found', code: 'not_found' });

    const scoreboards = pipeline.expandedConfig.root.scoreboards ?? [];
    const scoreboard = scoreboards.find((sb) => sb.name === name);
    if (!scoreboard) return reply.status(404).send({ ok: false, error: 'Scoreboard not found', code: 'not_found' });

    const units = await buildUnitSnapshots(event.id);
    const result = computeScoreboardFromData(scoreboard, pipeline.expandedConfig, { units });

    return reply.send(result);
  });

  // GET /api/:slug/audit/:unitId — per-unit slot breakdown
  app.get('/api/:slug/audit/:unitId', async (req, reply) => {
    const { slug, unitId: unitIdStr } = req.params as { slug: string; unitId: string };
    const unitId = parseInt(unitIdStr, 10);
    if (isNaN(unitId)) return reply.status(400).send({ ok: false, error: 'Bad request', code: 'bad_request' });

    const event = await loadEventBySlug(slug);
    if (!event) return reply.status(404).send({ ok: false, error: 'Not found', code: 'not_found' });

    const yaml = (event.config as Record<string, unknown>)?.yaml as string ?? '';
    const pipeline = await runPipeline(yaml, new Map());

    // Check specs visibility
    const visPolicy = pipeline.expandedConfig?.root?.visibility_policy ?? {};
    const eventSnapshot = { slug: event.slug ?? '', name: event.name, status: event.status as 'draft' | 'published' | 'closed', sections: {} };
    const specsVisible = evaluateSpecsVisible(visPolicy, eventSnapshot);

    const units = await buildUnitSnapshots(event.id);
    const unit = units.find((u) => u.id === unitId);
    if (!unit) return reply.status(404).send({ ok: false, error: 'Unit not found', code: 'not_found' });

    const specRows = unit.slot_results.flatMap((sr) => sr.games.map((g) => ({ slotIndex: sr.slot_index, game: g })));

    // Load spec strings for each slot
    const eventSlots = await db
      .select()
      .from(slots)
      .where(eq(slots.sectionId, event.id))
      .limit(10000);

    const slotIds = eventSlots.map((s) => s.id);
    const specRecords = slotIds.length > 0
      ? await db.select().from(gameSpecs).where(inArray(gameSpecs.slotId, slotIds)).limit(100000)
      : [];

    const specBySlot = new Map<number, string>();
    for (const spec of specRecords) {
      if (spec.slotId) specBySlot.set(spec.slotIndex, specsVisible ? spec.specString : '[not yet assigned]');
    }

    return reply.send({
      unitId: unit.id,
      unitName: unit.name,
      unitType: unit.type,
      slots: unit.slot_results.map((sr) => ({
        slotIndex: sr.slot_index,
        specString: specBySlot.get(sr.slot_index) ?? (specsVisible ? '' : '[not yet assigned]'),
        games: sr.games.map((g) => ({
          points: g.points,
          maxScore: g.max_score,
          bdr: g.bdr,
          turnCount: g.turn_count,
          strikes: g.strikes,
          source: g.source,
        })),
        slotScore: sr.score,
        scoreContribution: sr.score,
        valid: true,
      })),
      sectionScore: unit.score,
      sectionRank: unit.rank,
    });
  });

  // GET /api/:slug/badges/:userId — user's award issuances for this event
  app.get('/api/:slug/badges/:userId', async (req, reply) => {
    const { slug, userId: userIdStr } = req.params as { slug: string; userId: string };
    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) return reply.status(400).send({ ok: false, error: 'Bad request', code: 'bad_request' });

    const event = await loadEventBySlug(slug);
    if (!event) return reply.status(404).send({ ok: false, error: 'Not found', code: 'not_found' });

    // Load awards for this event
    const eventAwards = await db
      .select()
      .from(awardsTable)
      .where(eq(awardsTable.sectionId, event.id))
      .limit(10000);

    const awardIds = eventAwards.map((a) => a.id);
    const issuances = awardIds.length > 0
      ? await db
          .select()
          .from(awardIssuances)
          .where(and(eq(awardIssuances.userId, userId), inArray(awardIssuances.awardId, awardIds)))
          .limit(10000)
      : [];

    const badges = issuances.map((iso) => {
      const award = eventAwards.find((a) => a.id === iso.awardId)!;
      return {
        awardId: iso.awardId,
        awardName: award.awardName,
        issuedAt: iso.issuedAt,
        badge: award.badgeConfig,
      };
    });

    return reply.send({ userId, badges });
  });

  // GET /api/users/:userId/awards — all award issuances for a user across all events (public per Q7)
  app.get('/api/users/:userId/awards', async (req, reply) => {
    const { userId: userIdStr } = req.params as { userId: string };
    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) return reply.status(400).send({ ok: false, error: 'Bad request', code: 'bad_request' });

    const issuances = await db
      .select()
      .from(awardIssuances)
      .where(eq(awardIssuances.userId, userId))
      .limit(10000);

    if (issuances.length === 0) {
      return reply.send({ userId, badges: [] });
    }

    const awardIds = issuances.map((iso) => iso.awardId);
    const eventAwards = await db
      .select()
      .from(awardsTable)
      .where(inArray(awardsTable.id, awardIds))
      .limit(10000);

    const eventIds = [...new Set(eventAwards.map((a) => a.sectionId))];
    const eventRows = eventIds.length > 0
      ? await db.select({ id: sections.id, name: sections.name }).from(sections).where(inArray(sections.id, eventIds)).limit(1000)
      : [];
    const eventNameById = new Map(eventRows.map((e) => [e.id, e.name]));

    const badges = issuances.map((iso) => {
      const award = eventAwards.find((a) => a.id === iso.awardId)!;
      return {
        awardId: iso.awardId,
        awardName: award?.awardName ?? '',
        issuedAt: iso.issuedAt,
        eventName: award ? (eventNameById.get(award.sectionId) ?? '') : '',
        badge: award?.badgeConfig ?? null,
      };
    });

    return reply.send({ userId, badges });
  });
}
