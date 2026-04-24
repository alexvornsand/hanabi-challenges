import type { FastifyInstance } from 'fastify';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { eventOrganisers, registrations, sections, teamMembers } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

interface EventConfig {
  registration?: {
    policy?: {
      explicit?: boolean;
      implicit?: boolean;
      cardinality?: string;
    };
  };
  dimensions?: Array<{ axis: string; values: string[] }>;
}

export async function registrationsRoutes(app: FastifyInstance) {
  // POST /api/events/:slug/register
  app.post('/api/events/:slug/register', async (req, reply) => {
    await requireAuth(req, reply);
    if (reply.sent) return;

    const slug = (req.params as { slug: string }).slug;
    const body = req.body as {
      unitType?: 'individual' | 'team';
      unitId?: number;
      dimensionAxis?: string;
      divisionValue?: string;
    };

    if (!body?.unitType || !body?.unitId || !body?.dimensionAxis || !body?.divisionValue) {
      return reply.status(400).send({ ok: false, error: 'Missing required fields', code: 'bad_request' });
    }

    // Fetch event by slug
    const [event] = await db.select().from(sections).where(eq(sections.slug, slug)).limit(1);
    if (!event) {
      return reply.status(404).send({ ok: false, error: 'Event not found', code: 'not_found' });
    }
    if (event.status !== 'published') {
      return reply.status(400).send({ ok: false, error: 'Event is not published', code: 'event_not_published' });
    }

    const config = event.config as EventConfig;
    const regPolicy = config.registration?.policy ?? {};

    // Check registration policy
    if (regPolicy.explicit === false && regPolicy.implicit === true) {
      return reply.status(400).send({
        ok: false,
        error: 'This event uses implicit registration via game play',
        code: 'implicit_only',
      });
    }
    if (!regPolicy.explicit) {
      return reply.status(400).send({
        ok: false,
        error: 'This event uses implicit registration via game play',
        code: 'implicit_only',
      });
    }

    // If team unit type, verify user is a current member
    if (body.unitType === 'team') {
      const membership = await db
        .select()
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, body.unitId),
            eq(teamMembers.userId, req.userId),
            isNull(teamMembers.leftAt),
          ),
        )
        .limit(1);
      if (membership.length === 0) {
        return reply.status(403).send({ ok: false, error: 'Forbidden', code: 'forbidden' });
      }
    }

    // Validate division value against declared dimension values
    const dimensions = config.dimensions ?? [];
    const dimension = dimensions.find((d) => d.axis === body.dimensionAxis);
    if (dimension && !dimension.values.includes(body.divisionValue!)) {
      return reply.status(400).send({
        ok: false,
        error: `Invalid division value for axis ${body.dimensionAxis}`,
        code: 'invalid_division',
      });
    }

    // Enforce one_per_unit cardinality
    if (regPolicy.cardinality === 'one_per_unit') {
      const existing = await db
        .select()
        .from(registrations)
        .where(
          and(
            eq(registrations.eventId, event.id),
            eq(registrations.unitType, body.unitType),
            eq(registrations.unitId, body.unitId),
            eq(registrations.dimensionAxis, body.dimensionAxis),
          ),
        )
        .limit(1);
      if (existing.length > 0) {
        return reply.status(409).send({ ok: false, error: 'Already registered', code: 'already_registered' });
      }
    }

    const [registration] = await db
      .insert(registrations)
      .values({
        eventId: event.id,
        unitType: body.unitType,
        unitId: body.unitId,
        dimensionAxis: body.dimensionAxis,
        divisionValue: body.divisionValue,
        registeredBy: req.userId,
      })
      .returning();

    return reply.status(201).send({ registration });
  });

  // DELETE /api/events/:slug/register — unregister
  app.delete('/api/events/:slug/register', async (req, reply) => {
    await requireAuth(req, reply);
    if (reply.sent) return;

    const slug = (req.params as { slug: string }).slug;
    const body = req.body as {
      unitType?: 'individual' | 'team';
      unitId?: number;
      dimensionAxis?: string;
    };

    if (!body?.unitType || !body?.unitId || !body?.dimensionAxis) {
      return reply.status(400).send({ ok: false, error: 'Missing required fields', code: 'bad_request' });
    }

    const [event] = await db.select().from(sections).where(eq(sections.slug, slug)).limit(1);
    if (!event) {
      return reply.status(404).send({ ok: false, error: 'Event not found', code: 'not_found' });
    }

    // Authorisation: user must be the unit (individual) or a current team member
    if (body.unitType === 'individual') {
      if (req.userId !== body.unitId) {
        return reply.status(403).send({ ok: false, error: 'Forbidden', code: 'forbidden' });
      }
    } else {
      const membership = await db
        .select()
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, body.unitId),
            eq(teamMembers.userId, req.userId),
            isNull(teamMembers.leftAt),
          ),
        )
        .limit(1);
      if (membership.length === 0) {
        return reply.status(403).send({ ok: false, error: 'Forbidden', code: 'forbidden' });
      }
    }

    await db
      .delete(registrations)
      .where(
        and(
          eq(registrations.eventId, event.id),
          eq(registrations.unitType, body.unitType),
          eq(registrations.unitId, body.unitId),
          eq(registrations.dimensionAxis, body.dimensionAxis),
        ),
      );

    return reply.send({ ok: true });
  });

  // GET /api/events/:slug/registrations — list all registrations
  app.get('/api/events/:slug/registrations', async (req, reply) => {
    const slug = (req.params as { slug: string }).slug;

    const [event] = await db.select().from(sections).where(eq(sections.slug, slug)).limit(1);
    if (!event) {
      return reply.status(404).send({ ok: false, error: 'Event not found', code: 'not_found' });
    }

    // Check if requester is an organiser (optional auth — falls through if not)
    let isOrganiser = false;
    const userId = (req.headers as Record<string, string>)['x-user-id'];
    if (userId) {
      const organiserRow = await db
        .select()
        .from(eventOrganisers)
        .where(and(eq(eventOrganisers.eventId, event.id), eq(eventOrganisers.userId, parseInt(userId, 10))))
        .limit(1);
      isOrganiser = organiserRow.length > 0;
    }

    const rows = await db
      .select()
      .from(registrations)
      .where(eq(registrations.eventId, event.id))
      .limit(1000);

    const result = rows.map((r) => ({
      unitType: r.unitType,
      unitId: isOrganiser ? r.unitId : undefined,
      dimensionAxis: r.dimensionAxis,
      divisionValue: r.divisionValue,
      registeredAt: r.registeredAt,
    }));

    return reply.send({ registrations: result });
  });
}
