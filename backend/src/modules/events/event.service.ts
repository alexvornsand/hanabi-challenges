// src/modules/events/event.service.ts
import { pool } from '../../config/db';

export class EventNameExistsError extends Error {
  code = 'EVENT_NAME_EXISTS';
}

export class EventGameTemplateExistsError extends Error {
  code = 'EVENT_GAME_TEMPLATE_EXISTS';
}

export interface Event {
  id: number;
  slug: string;
  name: string;
  short_description: string | null;
  long_description: string;
  starts_at: string | null;
  ends_at: string | null;
}

export interface EventStage {
  event_stage_id: number;
  event_id: number;
  stage_index: number;
  label: string;
  stage_type: 'SINGLE' | 'ROUND_ROBIN' | 'BRACKET' | 'GAUNTLET';
  starts_at: string | null;
  ends_at: string | null;
  config_json: unknown;
  created_at: string;
}

export interface EventGameTemplate {
  id: number;
  event_stage_id: number;
  template_index: number;
  variant: string;
  seed_payload: string | null;
  metadata_json: unknown;
  created_at: string;
}

export interface EventTeam {
  id: number;
  event_id: number;
  name: string;
  created_at: string;
  team_size: number;
}

export interface EventDetail {
  id: number;
  slug: string;
  name: string;
  short_description: string | null;
  long_description: string;
  starts_at: string | null;
  ends_at: string | null;
}

export interface CreateEventInput {
  name: string;
  slug: string;
  short_description?: string | null;
  long_description: string;
  starts_at?: string | null;
  ends_at?: string | null;
}

/* ------------------------------------------
 * List all events
 * ----------------------------------------*/
export async function listEvents(): Promise<Event[]> {
  const result = await pool.query<Event>(
    `
    SELECT
      id,
      slug,
      name,
      short_description,
      long_description,
      starts_at,
      ends_at
    FROM events
    ORDER BY starts_at NULLS LAST, id
    `,
  );

  return result.rows;
}

/* ------------------------------------------
 * Create a new event
 * ----------------------------------------*/
export async function createEvent(input: CreateEventInput) {
  const { name, slug, short_description, long_description, starts_at, ends_at } = input;

  if (!slug) {
    throw { code: 'EVENT_SLUG_REQUIRED' } as { code: string };
  }
  if (!long_description) {
    throw { code: 'EVENT_LONG_DESCRIPTION_REQUIRED' } as { code: string };
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO events (name, slug, short_description, long_description, starts_at, ends_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, slug, short_description, long_description, starts_at, ends_at, created_at;
      `,
      [name, slug, short_description ?? null, long_description, starts_at, ends_at],
    );

    return result.rows[0];
  } catch (err) {
    const pgErr = err as { code?: string };

    if (pgErr.code === '23505') {
      throw new EventNameExistsError('Event name or slug must be unique');
    }
    throw err;
  }
}

/* ------------------------------------------
 * Get an event by slug
 * ----------------------------------------*/
export async function getEventBySlug(slug: string): Promise<EventDetail | null> {
  const result = await pool.query<EventDetail>(
    `
    SELECT
      id,
      slug,
      name,
      short_description,
      long_description,
      starts_at,
      ends_at
    FROM events
    WHERE slug = $1
    `,
    [slug],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
}

/* ------------------------------------------
 * List game templates for an event (by event ID)
 * ----------------------------------------*/
export async function listEventGameTemplates(eventId: number): Promise<EventGameTemplate[]> {
  const result = await pool.query<EventGameTemplate>(
    `
    SELECT
      egt.id,
      egt.event_stage_id,
      egt.template_index,
      egt.variant,
      egt.seed_payload,
      egt.metadata_json,
      egt.created_at
    FROM event_game_templates egt
    JOIN event_stages es ON es.event_stage_id = egt.event_stage_id
    WHERE es.event_id = $1
    ORDER BY es.stage_index, egt.template_index;
    `,
    [eventId],
  );

  return result.rows;
}

/* ------------------------------------------
 * Create a game template for an event stage
 * ----------------------------------------*/
export async function createEventGameTemplate(
  eventStageId: number,
  input: {
    template_index: number;
    variant?: string | null;
    seed_payload?: string | null;
    metadata_json?: unknown;
  },
): Promise<EventGameTemplate> {
  const {
    template_index,
    variant = null,
    seed_payload = null,
    metadata_json = {},
  } = input;
  const normalizedVariant = variant ?? 'No Variant';
  const normalizedMetadata = metadata_json ?? {};

  try {
    const result = await pool.query<EventGameTemplate>(
      `
      INSERT INTO event_game_templates (
        event_stage_id,
        template_index,
        variant,
        seed_payload,
        metadata_json
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, event_stage_id, template_index, variant, seed_payload, metadata_json, created_at;
      `,
      [eventStageId, template_index, normalizedVariant, seed_payload, normalizedMetadata],
    );

    return result.rows[0];
  } catch (err) {
    const pgErr = err as { code?: string };

    if (pgErr.code === '23505') {
      throw new EventGameTemplateExistsError('Template already exists for this stage with that index');
    }
    throw err;
  }
}

/* ------------------------------------------
 * List teams for an event (by event ID)
 * ----------------------------------------*/
export async function listEventTeams(eventId: number): Promise<EventTeam[]> {
  const result = await pool.query<EventTeam>(
    `
    SELECT
      t.id,
      t.event_id,
      t.name,
      t.created_at,
      t.team_size
    FROM event_teams t
    WHERE t.event_id = $1
    ORDER BY t.id;
    `,
    [eventId],
  );

  return result.rows;
}

/* ------------------------------------------
 * Create an event stage
 * ----------------------------------------*/
export async function createEventStage(input: {
  event_id: number;
  stage_index: number;
  label: string;
  stage_type: EventStage['stage_type'];
  starts_at?: string | null;
  ends_at?: string | null;
  config_json?: unknown;
}): Promise<EventStage> {
  const {
    event_id,
    stage_index,
    label,
    stage_type,
    starts_at = null,
    ends_at = null,
    config_json = {},
  } = input;
  const normalizedConfig = config_json ?? {};

  const result = await pool.query<EventStage>(
    `
    INSERT INTO event_stages (
      event_id,
      stage_index,
      label,
      stage_type,
      starts_at,
      ends_at,
      config_json
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING
      event_stage_id,
      event_id,
      stage_index,
      label,
      stage_type,
      starts_at,
      ends_at,
      config_json,
      created_at;
    `,
    [event_id, stage_index, label, stage_type, starts_at, ends_at, normalizedConfig],
  );

  return result.rows[0];
}
