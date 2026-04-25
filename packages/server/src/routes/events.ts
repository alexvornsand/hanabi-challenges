import type { FastifyInstance } from 'fastify';
import { and, eq, inArray, isNull, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  sections,
  eventOrganisers,
  gameSpecs,
  warningAcknowledgements,
  variantRegistry,
} from '../db/schema.js';
import { requireAuth, requireOrganiser } from '../middleware/auth.js';
import { runPipeline } from '@hanabi/dsl/src/pipeline.js';
import { generateSpecs, checkConflicts } from '@hanabi/dsl/src/seedEngine.js';
import type { VariantInfo, ExpandedSection, ExpandedSlot, SlotSource } from '@hanabi/dsl';
import { notImplemented } from '../types.js';

function isExpandedSlot(slot: SlotSource): slot is ExpandedSlot {
  return !('kind' in slot);
}

function collectNonDeferredSlots(section: ExpandedSection): ExpandedSlot[] {
  const result: ExpandedSlot[] = [];
  for (const slot of section.slots) {
    if (isExpandedSlot(slot)) result.push(slot);
  }
  for (const child of section.sections) {
    result.push(...collectNonDeferredSlots(child));
  }
  return result;
}

function buildVariantsMap(rows: { variantId: number; name: string; shortName: string; maxScore: number; suitCount: number }[]): Map<number, VariantInfo> {
  return new Map(
    rows.map((v) => [
      v.variantId,
      { id: v.variantId, name: v.name, short_name: v.shortName, max_score: v.maxScore, suit_count: v.suitCount },
    ]),
  );
}

export async function eventsRoutes(app: FastifyInstance) {
  // GET /api/admin/events/new — event template (must be registered before /:id)
  app.get('/api/admin/events/new', async (_req, reply) => {
    return reply.send({ templates: [] });
  });

  // GET /api/admin/events — list events where requester is organiser
  app.get('/api/admin/events', async (req, reply) => {
    await requireAuth(req, reply);
    if (reply.sent) return;

    const organiserRows = await db
      .select({ eventId: eventOrganisers.eventId })
      .from(eventOrganisers)
      .where(eq(eventOrganisers.userId, req.userId))
      .limit(10000);

    const eventIds = organiserRows.map((r) => r.eventId);
    if (eventIds.length === 0) return reply.send({ events: [] });

    const events = await db
      .select({
        id: sections.id,
        slug: sections.slug,
        name: sections.name,
        status: sections.status,
        updatedAt: sections.updatedAt,
      })
      .from(sections)
      .where(and(inArray(sections.id, eventIds), isNull(sections.parentId)))
      .orderBy(desc(sections.updatedAt))
      .limit(10000);

    return reply.send({ events });
  });

  // GET /api/admin/events/:id — load event with pipeline result
  app.get('/api/admin/events/:id', async (req, reply) => {
    const id = parseInt((req.params as { id: string }).id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ ok: false, error: 'invalid id', code: 'bad_request' });
    }

    await requireOrganiser(req, reply, id, db);
    if (reply.sent) return;

    const [event] = await db.select().from(sections).where(eq(sections.id, id)).limit(1);
    if (!event) {
      return reply.status(404).send({ ok: false, error: 'Not found', code: 'not_found' });
    }

    const variantRows = await db.select().from(variantRegistry).limit(10000);
    const variantsMap = buildVariantsMap(variantRows);

    const yaml = (event.config as Record<string, unknown>)?.yaml as string ?? '';
    const pipeline = await runPipeline(yaml, variantsMap);

    const ackRows = await db
      .select({ warningCode: warningAcknowledgements.warningCode })
      .from(warningAcknowledgements)
      .where(eq(warningAcknowledgements.eventId, id))
      .limit(10000);

    return reply.send({
      id: event.id,
      slug: event.slug,
      name: event.name,
      status: event.status,
      yaml,
      diagnostics: pipeline.diagnostics,
      canSave: pipeline.canSave,
      canPublish: pipeline.canPublish,
      acknowledgedWarnings: ackRows.map((r) => r.warningCode),
    });
  });

  // POST /api/admin/events/:id/save
  app.post('/api/admin/events/:id/save', async (req, reply) => {
    const id = parseInt((req.params as { id: string }).id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ ok: false, error: 'invalid id', code: 'bad_request' });
    }

    await requireOrganiser(req, reply, id, db);
    if (reply.sent) return;

    const body = req.body as { yaml?: string };
    if (!body?.yaml) {
      return reply.status(400).send({ ok: false, error: 'yaml is required', code: 'bad_request' });
    }

    const variantRows = await db.select().from(variantRegistry).limit(10000);
    const variantsMap = buildVariantsMap(variantRows);

    const pipeline = await runPipeline(body.yaml, variantsMap);

    let eventId: number = id;
    if (pipeline.canSave) {
      const slug = pipeline.parseResult?.raw?.event?.slug ?? null;
      const name = pipeline.parseResult?.raw?.event?.name ?? 'Untitled';

      const [updated] = await db
        .update(sections)
        .set({ config: { yaml: body.yaml }, slug, name, status: 'draft', updatedAt: new Date() })
        .where(eq(sections.id, id))
        .returning({ id: sections.id });

      if (updated) eventId = updated.id;
    }

    return reply.send({
      eventId,
      diagnostics: pipeline.diagnostics,
      canSave: pipeline.canSave,
      canPublish: pipeline.canPublish,
    });
  });

  // POST /api/admin/events/:id/publish
  app.post('/api/admin/events/:id/publish', async (req, reply) => {
    const id = parseInt((req.params as { id: string }).id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ ok: false, error: 'invalid id', code: 'bad_request' });
    }

    await requireOrganiser(req, reply, id, db);
    if (reply.sent) return;

    const [event] = await db.select().from(sections).where(eq(sections.id, id)).limit(1);
    if (!event) {
      return reply.status(404).send({ ok: false, error: 'Not found', code: 'not_found' });
    }

    const variantRows = await db.select().from(variantRegistry).limit(10000);
    const variantsMap = buildVariantsMap(variantRows);

    const yaml = (event.config as Record<string, unknown>)?.yaml as string ?? '';
    const pipeline = await runPipeline(yaml, variantsMap);

    if (!pipeline.canSave) {
      return reply.status(400).send({ ok: false, error: 'Event has errors', code: 'has_errors' });
    }

    // Check all warnings are acknowledged
    const warnings = pipeline.diagnostics.filter((d) => d.severity === 'warning');
    if (warnings.length > 0) {
      const ackRows = await db
        .select({ warningCode: warningAcknowledgements.warningCode })
        .from(warningAcknowledgements)
        .where(eq(warningAcknowledgements.eventId, id))
        .limit(10000);

      const ackedCodes = new Set(ackRows.map((r) => r.warningCode));
      const unacknowledged = warnings.filter((w) => !ackedCodes.has(w.code)).map((w) => w.code);
      if (unacknowledged.length > 0) {
        return reply.status(400).send({
          ok: false,
          error: 'Unacknowledged warnings',
          code: 'unacknowledged_warnings',
          unacknowledged,
        });
      }
    }

    const expandedConfig = pipeline.expandedConfig;
    if (!expandedConfig) {
      return reply.status(400).send({ ok: false, error: 'Cannot expand config', code: 'expand_failed' });
    }

    const nonDeferredSlots = collectNonDeferredSlots(expandedConfig.root);

    // Load existing specs for conflict detection
    const existingRows = await db
      .select({ specString: gameSpecs.specString })
      .from(gameSpecs)
      .limit(1000000);
    const registry = new Set(existingRows.map((r) => r.specString));

    const allSpecs: Array<{ specString: string; sectionId: number; slotIndex: number }> = [];

    for (const slot of nonDeferredSlots) {
      const specs = generateSpecs(slot.seed_pattern, { eventID: id, slotIndex: slot.slot_index });
      const conflicts = checkConflicts(specs, registry);
      if (conflicts.length > 0) {
        return reply.status(409).send({ ok: false, error: 'Spec conflict', code: 'spec_conflict', conflicts });
      }
      for (const spec of specs) {
        allSpecs.push({ specString: spec, sectionId: id, slotIndex: slot.slot_index });
        registry.add(spec);
      }
    }

    if (allSpecs.length > 0) {
      await db.insert(gameSpecs).values(allSpecs).onConflictDoNothing();
    }

    await db
      .update(sections)
      .set({ status: 'published', updatedAt: new Date() })
      .where(eq(sections.id, id));

    return reply.send({ ok: true, specsRegistered: allSpecs.length });
  });

  // POST /api/admin/events/:id/acknowledge-warning
  app.post('/api/admin/events/:id/acknowledge-warning', async (req, reply) => {
    const id = parseInt((req.params as { id: string }).id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ ok: false, error: 'invalid id', code: 'bad_request' });
    }

    await requireOrganiser(req, reply, id, db);
    if (reply.sent) return;

    const body = req.body as { code?: string };
    if (!body?.code) {
      return reply.status(400).send({ ok: false, error: 'code is required', code: 'bad_request' });
    }

    await db
      .insert(warningAcknowledgements)
      .values({ eventId: id, warningCode: body.code, acknowledgedBy: req.userId })
      .onConflictDoNothing();

    return reply.send({ ok: true });
  });

  // POST /api/admin/events/:id/close — stub (ticket 039)
  app.post('/api/admin/events/:id/close', async (_req, reply) => notImplemented(reply));

  // GET /api/admin/events/:id/manage — stub (ticket 031)
  app.get('/api/admin/events/:id/manage', async (_req, reply) => notImplemented(reply));
}
