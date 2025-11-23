// src/modules/events/event.routes.ts
import { Router, Request, Response } from 'express';
import { authRequired, requireAdmin } from '../../middleware/authMiddleware';
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
