// src/modules/events/event.routes.ts
import { Router, Request, Response } from 'express';
import { authRequired, requireAdmin, AuthenticatedRequest } from '../../middleware/authMiddleware';
import {
  listEvents,
  createEvent,
  listEventGameTemplates,
  createEventGameTemplate,
  listEventTeams,
  getEventBySlug,
  createEventStage,
} from './event.service';
import { pool } from '../../config/db';

const router = Router();

/* ------------------------------------------
 *  Helper: look up numeric event_id from slug
 * ----------------------------------------*/
async function getEventId(slug: string): Promise<number | null> {
  const result = await pool.query<{ id: number }>(
    `SELECT id FROM events WHERE slug = $1`,
    [slug],
  );
  return result.rowCount > 0 ? result.rows[0].id : null;
}

/* ------------------------------------------
 *  GET /api/events
 * ----------------------------------------*/
router.get('/', async (_req: Request, res: Response) => {
  try {
    const events = await listEvents();
    res.json(events);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/* ------------------------------------------
 *  GET /api/events/:slug/memberships
 *  List user memberships for this event (for client-side validation)
 * ----------------------------------------*/
router.get('/:slug/memberships', async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    const eventId = await getEventId(slug);
    if (!eventId) return res.status(404).json({ error: 'Event not found' });

    const result = await pool.query(
      `
      SELECT
        tm.user_id,
        u.display_name,
        et.team_size,
        et.id AS event_team_id
      FROM team_memberships tm
      JOIN event_teams et ON et.id = tm.event_team_id
      JOIN users u ON u.id = tm.user_id
      WHERE et.event_id = $1;
      `,
      [eventId],
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching event memberships:', err);
    res.status(500).json({ error: 'Failed to fetch memberships' });
  }
});

/* ------------------------------------------
 *  POST /api/events/:slug/register
 *  Create a team and add members (existing or pending)
 * ----------------------------------------*/
router.post('/:slug/register', authRequired, async (req: AuthenticatedRequest, res: Response) => {
  const { slug } = req.params;
  const { team_name, team_size, members } = req.body;
  const currentUserId = req.user?.userId;

  if (!team_name || team_size == null || !Array.isArray(members)) {
    return res.status(400).json({ error: 'team_name, team_size, and members are required' });
  }

  const sizeNum = Number(team_size);
  if (!Number.isInteger(sizeNum) || sizeNum < 2 || sizeNum > 6) {
    return res.status(400).json({ error: 'team_size must be an integer between 2 and 6' });
  }

  if (!currentUserId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const memberEntries = members as Array<{
    user_id?: number;
    display_name?: string;
    role?: 'PLAYER' | 'STAFF';
  }>;

  if (memberEntries.length === 0) {
    return res.status(400).json({ error: 'At least one member is required' });
  }

  // Ensure current user is included
  const includesCurrentUser = memberEntries.some(
    (m) => m.user_id && Number(m.user_id) === currentUserId,
  );
  if (!includesCurrentUser) {
    return res.status(400).json({ error: 'Current user must be part of the team' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventResult = await client.query<{ id: number }>(
      `SELECT id FROM events WHERE slug = $1`,
      [slug],
    );
    if (eventResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }
    const eventId = eventResult.rows[0].id;

    // Check if any member already has a team in this event with the same size
    const memberUserIds = memberEntries.map((m) => m.user_id).filter((id) => id != null) as number[];
    if (memberUserIds.length > 0) {
      const conflictCheck = await client.query(
        `
        SELECT DISTINCT u.display_name
        FROM team_memberships tm
        JOIN event_teams et ON et.id = tm.event_team_id
        JOIN users u ON u.id = tm.user_id
        WHERE et.event_id = $1
          AND et.team_size = $2
          AND tm.user_id = ANY($3::int[])
        `,
        [eventId, sizeNum, memberUserIds],
      );
      if (conflictCheck.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `These users already have a ${sizeNum}p team for this event: ${conflictCheck
            .rows.map((r) => r.display_name)
            .join(', ')}`,
        });
      }
    }

    const teamResult = await client.query(
      `
      INSERT INTO event_teams (event_id, name, team_size)
      VALUES ($1, $2, $3)
      RETURNING id, event_id, name, team_size, created_at;
      `,
      [eventId, team_name, sizeNum],
    );
    const team = teamResult.rows[0];

    const addedMembers: unknown[] = [];
    const pendingMembers: unknown[] = [];

    for (const m of memberEntries) {
      const role = m.role === 'STAFF' ? 'STAFF' : 'PLAYER';
      if (m.user_id) {
        const memberResult = await client.query(
          `
          INSERT INTO team_memberships (event_team_id, user_id, role, is_listed)
          VALUES ($1, $2, $3, true)
          RETURNING id, event_team_id, user_id, role, is_listed, created_at;
          `,
          [team.id, Number(m.user_id), role],
        );
        const memberRow = memberResult.rows[0];

        // Fetch display name and colors
        const userResult = await client.query(
          `
          SELECT display_name, color_hex, text_color
          FROM users
          WHERE id = $1;
          `,
          [memberRow.user_id],
        );
        const userInfo = userResult.rows[0] ?? {
          display_name: 'Unknown',
          color_hex: '#777777',
          text_color: '#ffffff',
        };

        addedMembers.push({ ...memberRow, ...userInfo });
      } else if (m.display_name) {
        const pendingResult = await client.query(
          `
          INSERT INTO pending_team_members (event_team_id, display_name, role)
          VALUES ($1, $2, $3)
          RETURNING id, event_team_id, display_name, role, created_at;
          `,
          [team.id, m.display_name, role],
        );
        pendingMembers.push(pendingResult.rows[0]);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      team,
      members: addedMembers,
      pending: pendingMembers,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    const e = err as { code?: string };
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Duplicate team or member detected' });
    }

    console.error('Error registering team:', err);
    res.status(500).json({ error: 'Failed to register team' });
  } finally {
    client.release();
  }
});

/* ------------------------------------------
 *  POST /api/events  (ADMIN)
 * ----------------------------------------*/
router.post('/', authRequired, requireAdmin, async (req: Request, res: Response) => {
  const { name, slug, short_description, long_description, starts_at, ends_at } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!slug) return res.status(400).json({ error: 'slug is required' });
  if (!long_description) return res.status(400).json({ error: 'long_description is required' });

  try {
    const event = await createEvent({
      name,
      slug,
      short_description: short_description ?? null,
      long_description,
      starts_at: starts_at ?? null,
      ends_at: ends_at ?? null,
    });

    res.status(201).json(event);
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'EVENT_NAME_EXISTS') {
      return res.status(409).json({ error: 'Event name must be unique' });
    }

    console.error('Error creating event:', err);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

/* ------------------------------------------
 *  GET /api/events/:slug
 * ----------------------------------------*/
router.get('/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    const event = await getEventBySlug(slug);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (err) {
    console.error('Error fetching event by slug:', err);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

/* ------------------------------------------
 *  GET /api/events/:slug/stages
 *  Create a stage is done via POST /api/events/:slug/stages
 * ----------------------------------------*/
router.post('/:slug/stages', authRequired, requireAdmin, async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { stage_index, label, stage_type, starts_at, ends_at, config_json } = req.body;

  if (stage_index == null || !label || !stage_type) {
    return res.status(400).json({ error: 'stage_index, label, and stage_type are required' });
  }

  try {
    const eventId = await getEventId(slug);
    if (!eventId) return res.status(404).json({ error: 'Event not found' });

    const stage = await createEventStage({
      event_id: eventId,
      stage_index,
      label,
      stage_type,
      starts_at: starts_at ?? null,
      ends_at: ends_at ?? null,
      config_json: config_json ?? {},
    });

    res.status(201).json(stage);
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'stage_index must be unique within the event' });
    }

    console.error('Error creating event stage:', err);
    res.status(500).json({ error: 'Failed to create event stage' });
  }
});

/* ------------------------------------------
 *  GET /api/events/:slug/game-templates
 * ----------------------------------------*/
router.get('/:slug/game-templates', async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    const eventId = await getEventId(slug);
    if (!eventId) return res.status(404).json({ error: 'Event not found' });

    const templates = await listEventGameTemplates(eventId);
    res.json(templates);
  } catch (err) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/* ------------------------------------------
 *  POST /api/events/:slug/game-templates  (ADMIN)
 * ----------------------------------------*/
router.post(
  '/:slug/game-templates',
  authRequired,
  requireAdmin,
  async (req: Request, res: Response) => {
    const { slug } = req.params;
    const { event_stage_id, template_index, variant, seed_payload, metadata_json } = req.body;

    if (event_stage_id == null || template_index == null) {
      return res.status(400).json({ error: 'event_stage_id and template_index are required' });
    }

    try {
      const eventId = await getEventId(slug);
      if (!eventId) return res.status(404).json({ error: 'Event not found' });

      // Ensure the stage belongs to this event
      const stageCheck = await pool.query<{ event_id: number }>(
        `SELECT event_id FROM event_stages WHERE event_stage_id = $1`,
        [event_stage_id],
      );
      if (stageCheck.rowCount === 0 || stageCheck.rows[0].event_id !== eventId) {
        return res.status(400).json({ error: 'event_stage_id does not belong to this event' });
      }

      const template = await createEventGameTemplate(event_stage_id, {
        template_index,
        variant: variant ?? null,
        seed_payload: seed_payload ?? null,
        metadata_json: metadata_json ?? {},
      });

      res.status(201).json(template);
    } catch (err) {
      const e = err as { code?: string };
      if (e.code === 'EVENT_GAME_TEMPLATE_EXISTS') {
        return res.status(409).json({
          error: 'Template already exists for this stage with that index',
        });
      }

      console.error('Error creating game template:', err);
      res.status(500).json({ error: 'Failed to create game template' });
    }
  },
);

/* ------------------------------------------
 *  GET /api/events/:slug/teams
 * ----------------------------------------*/
router.get('/:slug/teams', async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    const eventId = await getEventId(slug);
    if (!eventId) return res.status(404).json({ error: 'Event not found' });

    const teams = await listEventTeams(eventId);
    res.json(teams);
  } catch (err) {
    console.error('Error fetching teams:', err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

export default router;
