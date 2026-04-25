import type { FastifyInstance } from 'fastify';
import { and, eq, inArray, isNull, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  sections,
  eventOrganisers,
  gameSpecs,
  warningAcknowledgements,
  variantRegistry,
  adminInputs,
  users,
} from '../db/schema.js';
import { requireAuth, requireOrganiser, requirePlatformOrganiser } from '../middleware/auth.js';
import { runPipeline } from '@hanabi/dsl/src/pipeline.js';
import { generateSpecs, checkConflicts } from '@hanabi/dsl/src/seedEngine.js';
import type { VariantInfo, ExpandedSection, ExpandedSlot, SlotSource } from '@hanabi/dsl';
import { onAdminTrigger } from '../lib/slotTriggerEngine.js';
import { processAwards } from '../lib/awardEngine.js';
import { scrapeGames } from '../jobs/scrapeGames.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function buildVariantsMap(
  rows: { variantId: number; name: string; shortName: string; maxScore: number; suitCount: number }[],
): Map<number, VariantInfo> {
  return new Map(
    rows.map((v) => [
      v.variantId,
      {
        id: v.variantId,
        name: v.name,
        short_name: v.shortName,
        max_score: v.maxScore,
        suit_count: v.suitCount,
      },
    ]),
  );
}

// ---------------------------------------------------------------------------
// Deferrable fields — valid admin-sentinel field paths and their control types
// ---------------------------------------------------------------------------

type ControlType =
  | 'datetime'
  | 'integer'
  | 'unit_list'
  | 'checkbox_list'
  | 'trigger_button'
  | 'iteration_control';

interface FieldSpec {
  controlType: ControlType;
  description: string;
}

const DEFERRABLE_FIELDS: Record<string, FieldSpec> = {
  'time_window.start': { controlType: 'datetime', description: 'Set section start time' },
  'time_window.end': { controlType: 'datetime', description: 'Set section end time' },
  'matchmaking.assignments': { controlType: 'unit_list', description: 'Assign units to matchups' },
  'advancement.decision': { controlType: 'checkbox_list', description: 'Decide which units advance' },
  'lazy_trigger.fire': { controlType: 'trigger_button', description: 'Fire the next lazy slot' },
  'sequence.count': { controlType: 'iteration_control', description: 'Set sequence iteration count' },
};

function isISO8601DateTime(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value) &&
    !isNaN(Date.parse(value))
  );
}

// ---------------------------------------------------------------------------
// Admin panel state helper
// ---------------------------------------------------------------------------

interface PendingInput {
  fieldPath: string;
  description: string;
  controlType: ControlType;
  currentValue: unknown;
  isActionable: boolean;
  divisionCount: number;
}

function collectAdminFields(
  section: ExpandedSection,
  isPublished: boolean,
  prefix?: string,
): PendingInput[] {
  const fields: PendingInput[] = [];
  const sectionKey = prefix ?? section.slug ?? section.name.toLowerCase().replace(/\s+/g, '_');

  const tw = section.time_window;
  if (tw?.start === 'admin') {
    fields.push({
      fieldPath: `${sectionKey}.time_window.start`,
      description: `Set start time for ${section.name}`,
      controlType: 'datetime',
      currentValue: null,
      isActionable: isPublished,
      divisionCount: 1,
    });
  }
  if (tw?.end === 'admin') {
    fields.push({
      fieldPath: `${sectionKey}.time_window.end`,
      description: `Set end time for ${section.name}`,
      controlType: 'datetime',
      currentValue: null,
      isActionable: isPublished,
      divisionCount: 1,
    });
  }
  if (section.matchmaking?.type === 'manual') {
    fields.push({
      fieldPath: `${sectionKey}.matchmaking.assignments`,
      description: `Assign units for ${section.name}`,
      controlType: 'unit_list',
      currentValue: null,
      isActionable: isPublished,
      divisionCount: 1,
    });
  }
  if (section.advancement?.predicate === 'admin') {
    fields.push({
      fieldPath: `${sectionKey}.advancement.decision`,
      description: `Decide advancement for ${section.name}`,
      controlType: 'checkbox_list',
      currentValue: null,
      isActionable: isPublished,
      divisionCount: 1,
    });
  }
  for (const slot of section.slots) {
    if (isExpandedSlot(slot) && slot.lazy_trigger === 'admin') {
      fields.push({
        fieldPath: `${sectionKey}.slots.${slot.slot_index}.lazy_trigger.fire`,
        description: `Fire lazy slot ${slot.slot_index} in ${section.name}`,
        controlType: 'trigger_button',
        currentValue: null,
        isActionable: isPublished,
        divisionCount: 1,
      });
    } else if (!isExpandedSlot(slot) && slot.trigger_type === 'admin_sequence') {
      fields.push({
        fieldPath: `${sectionKey}.sequence.count`,
        description: `Set sequence count for ${section.name}`,
        controlType: 'iteration_control',
        currentValue: null,
        isActionable: isPublished,
        divisionCount: 1,
      });
    }
  }
  for (const child of section.sections) {
    fields.push(...collectAdminFields(child, isPublished));
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function eventsRoutes(app: FastifyInstance) {
  // GET /api/admin/events/new — event template (must be registered before /:id)
  app.get('/api/admin/events/new', async (_req, reply) => {
    return reply.send({ templates: [] });
  });

  // POST /api/admin/events — create new event (platform organiser only)
  app.post('/api/admin/events', async (req, reply) => {
    await requirePlatformOrganiser(req, reply, db);
    if (reply.sent) return;

    const body = req.body as { yaml?: string };
    if (!body?.yaml) {
      return reply.status(400).send({ ok: false, error: 'yaml is required', code: 'bad_request' });
    }

    const variantRows = await db.select().from(variantRegistry).limit(10000);
    const variantsMap = buildVariantsMap(variantRows);

    const pipeline = await runPipeline(body.yaml, variantsMap);

    const slug = pipeline.parseResult?.raw?.event?.slug ?? null;
    const name = pipeline.parseResult?.raw?.event?.name ?? 'Untitled';

    const [newSection] = await db
      .insert(sections)
      .values({
        config: { yaml: body.yaml },
        slug,
        name,
        status: 'draft',
        sectionType: 'branch',
      })
      .returning({ id: sections.id, slug: sections.slug });

    await db.insert(eventOrganisers).values({ eventId: newSection!.id, userId: req.userId });

    return reply.status(201).send({
      ok: true,
      eventId: newSection!.id,
      slug: newSection!.slug,
      diagnostics: pipeline.diagnostics,
      canSave: pipeline.canSave,
      canPublish: pipeline.canPublish,
    });
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
  // (must come before /:id/manage etc. to prevent conflict)
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

    // Validate organisers listed in YAML hold platform organiser status
    const organisersInYaml: string[] = pipeline.parseResult?.raw?.event?.organisers ?? [];
    if (organisersInYaml.length > 0) {
      const userRows = await db
        .select({ displayName: users.displayName, role: users.role })
        .from(users)
        .where(inArray(users.displayName, organisersInYaml))
        .limit(1000);
      const validOrganisers = new Set(
        userRows
          .filter((u) => u.role === 'ADMIN' || u.role === 'SUPERADMIN')
          .map((u) => u.displayName),
      );
      const invalid = organisersInYaml.filter((name) => !validOrganisers.has(name));
      if (invalid.length > 0) {
        pipeline.diagnostics.push({
          code: 'invalid_organiser_account',
          message: `These display names are not platform organisers: ${invalid.join(', ')}`,
          severity: 'error',
          path: 'event.organisers',
        });
        pipeline.canSave = false;
        pipeline.canPublish = false;
      }
    }

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

  // POST /api/admin/events/:id/inputs/:fieldPath — set admin-sentinel field value
  app.post('/api/admin/events/:id/inputs/:fieldPath', async (req, reply) => {
    const id = parseInt((req.params as { id: string }).id, 10);
    const fieldPath = (req.params as { fieldPath: string }).fieldPath;

    if (isNaN(id)) {
      return reply.status(400).send({ ok: false, error: 'invalid id', code: 'bad_request' });
    }

    await requireOrganiser(req, reply, id, db);
    if (reply.sent) return;

    // Validate fieldPath is a known deferrable field
    const fieldSpec = DEFERRABLE_FIELDS[fieldPath];
    if (!fieldSpec) {
      return reply.status(400).send({
        ok: false,
        error: `Unknown or non-deferrable field path: ${fieldPath}`,
        code: 'unknown_field_path',
      });
    }

    const body = req.body as { value?: unknown };
    const value = body?.value;

    // Validate value type
    if (fieldSpec.controlType === 'datetime') {
      if (!isISO8601DateTime(value)) {
        return reply.status(400).send({
          ok: false,
          error: 'Value must be an ISO 8601 datetime string (e.g. 2026-01-01T00:00:00Z)',
          code: 'invalid_value',
        });
      }
    } else if (
      fieldSpec.controlType === 'integer' ||
      fieldSpec.controlType === 'iteration_control'
    ) {
      if (!Number.isInteger(value)) {
        return reply.status(400).send({
          ok: false,
          error: 'Value must be an integer',
          code: 'invalid_value',
        });
      }
    }

    const setAt = new Date();
    await db.insert(adminInputs).values({
      sectionId: id,
      fieldPath,
      value: value as Record<string, unknown>,
      setAt,
      setBy: req.userId,
    });

    // Wire trigger-type fields into the slot trigger engine
    if (
      fieldSpec.controlType === 'trigger_button' ||
      fieldSpec.controlType === 'iteration_control'
    ) {
      await onAdminTrigger(id, fieldPath, db);
    }

    return reply.send({ ok: true, fieldPath, value, setAt: setAt.toISOString() });
  });

  // GET /api/admin/events/:id/manage — admin panel state
  app.get('/api/admin/events/:id/manage', async (req, reply) => {
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

    const existingInputs = await db
      .select({ fieldPath: adminInputs.fieldPath, value: adminInputs.value })
      .from(adminInputs)
      .where(eq(adminInputs.sectionId, id))
      .limit(10000);

    const inputsByPath = new Map(existingInputs.map((i) => [i.fieldPath, i.value]));
    const isPublished = event.status === 'published';

    let pendingInputs: PendingInput[] = [];
    if (pipeline.expandedConfig) {
      pendingInputs = collectAdminFields(pipeline.expandedConfig.root, isPublished);
      // Overlay existing values
      for (const input of pendingInputs) {
        if (inputsByPath.has(input.fieldPath)) {
          input.currentValue = inputsByPath.get(input.fieldPath);
        }
      }
    }

    const scrapeSchedule = (pipeline.expandedConfig?.root as unknown as Record<string, unknown>)?.scrape_schedule as string | undefined;

    return reply.send({ pendingInputs, scrapeSchedule: scrapeSchedule ?? null });
  });

  // POST /api/admin/events/:id/scrape — on-demand scrape trigger
  app.post('/api/admin/events/:id/scrape', async (req, reply) => {
    const id = parseInt((req.params as { id: string }).id, 10);
    if (isNaN(id)) {
      return reply.status(400).send({ ok: false, error: 'invalid id', code: 'bad_request' });
    }
    await requireOrganiser(req, reply, id, db);
    if (reply.sent) return;
    const { inserted } = await scrapeGames(db);
    return reply.send({ ok: true, gamesInserted: inserted });
  });

  // POST /api/admin/events/:id/close
  app.post('/api/admin/events/:id/close', async (req, reply) => {
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
    if (event.status !== 'published') {
      return reply.status(400).send({ ok: false, error: 'Event must be published to close', code: 'not_published' });
    }

    // Load pipeline for expandedConfig
    const variantRows = await db.select().from(variantRegistry).limit(10000);
    const variantsMap = buildVariantsMap(variantRows);
    const yaml = (event.config as Record<string, unknown>)?.yaml as string ?? '';
    const pipeline = await runPipeline(yaml, variantsMap);

    // Set status to closed
    await db.update(sections).set({ status: 'closed', updatedAt: new Date() }).where(eq(sections.id, id));

    // Process awards
    let awardsIssued = 0;
    if (pipeline.expandedConfig) {
      awardsIssued = await processAwards(pipeline.expandedConfig, id, db);
    }

    return reply.send({ ok: true, awardsIssued });
  });
}
