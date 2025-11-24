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
import { listTeamMembers } from '../teams/team.service';

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
 *  POST /api/events/:slug/teams/:teamId/validate-replay
 *  Live-validate a replay URL/ID against team + template
 * ----------------------------------------*/
router.post('/:slug/teams/:teamId/validate-replay', authRequired, async (req: AuthenticatedRequest, res: Response) => {
  const { slug, teamId } = req.params;
  const body = req.body as { template_id?: number; templateId?: number; replay?: string };
  const templateIdRaw = body.template_id ?? body.templateId ?? (req.query.template_id as string | undefined);
  const template_id = templateIdRaw != null ? Number(templateIdRaw) : undefined;
  const { replay } = body;
  let step = 'start';

  console.log('[validate-replay] start', {
    slug,
    teamId,
    template_id,
    replaySnippet: replay?.slice?.(0, 100),
  });

  if (!template_id || Number.isNaN(template_id) || !replay) {
    console.warn('[validate-replay] missing fields', { template_id, replayPresent: !!replay });
    return res.status(400).json({ error: 'template_id and replay are required' });
  }

  const gameId = parseGameId(replay);
  if (!gameId) {
    console.warn('[validate-replay] parse fail', { replay });
    return res.status(400).json({ error: 'Unable to parse game id from replay/link' });
  }

  const teamIdNum = Number(teamId);
  if (!Number.isInteger(teamIdNum)) {
    return res.status(400).json({ error: 'Invalid team id' });
  }

  try {
    step = 'lookup event';
    const eventId = await getEventId(slug);
    if (!eventId) return res.status(404).json({ error: 'Event not found' });
    console.log('[validate-replay] event', { eventId });

    step = 'lookup team';
    const teamResult = await pool.query(
      `
      SELECT id, team_size, event_id
      FROM event_teams
      WHERE id = $1 AND event_id = $2;
      `,
      [teamIdNum, eventId],
    );
    if (teamResult.rowCount === 0) {
      return res.status(404).json({ error: 'Team not found for this event' });
    }
    const team = teamResult.rows[0] as { id: number; team_size: number; event_id: number };
    console.log('[validate-replay] team', { team });

    step = 'lookup template';
    const tplResult = await pool.query(
      `
      SELECT egt.id, egt.seed_payload, egt.variant, es.event_id
      FROM event_game_templates egt
      JOIN event_stages es ON es.event_stage_id = egt.event_stage_id
      WHERE egt.id = $1;
      `,
      [template_id],
    );
    if (tplResult.rowCount === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    const tpl = tplResult.rows[0] as { id: number; seed_payload: string | null; variant: string; event_id: number };
    if (tpl.event_id !== eventId) {
      return res.status(400).json({ error: 'Template does not belong to this event' });
    }
    console.log('[validate-replay] template', { tpl });

    const members = await listTeamMembers(team.id);
    const memberNames = members.map((m) => m.display_name);
    console.log('[validate-replay] members', memberNames);

    // Stage 1: fetch export and validate players/seed/size
    step = 'fetch export';
    const exportJson = await fetchJsonWithTimeout(`https://hanab.live/export/${gameId}`);
    console.log('[validate-replay] export fetched', {
      keys: Object.keys(exportJson ?? {}),
      players: exportJson?.players ?? exportJson?.playerNames ?? exportJson?.player_names,
      seed: exportJson?.seed,
    });
    if (!exportJson || typeof exportJson !== 'object') {
      return res.status(400).json({ error: 'Invalid export payload from hanab.live' });
    }
    const exportPlayers =
      exportJson.players ??
      exportJson.playerNames ??
      exportJson.player_names ??
      [];
    const seedString = exportJson.seed ?? '';

    // Check players subset
    const missingPlayers = exportPlayers.filter((p) => !memberNames.includes(p));
    if (missingPlayers.length > 0) {
      return res.status(400).json({ error: `Replay includes players not on this team: ${missingPlayers.join(', ')}` });
    }

    // Check seed and player count from seed string
    const seedMatch = seedString.match(/p(\d+)v\d+s([A-Za-z0-9]+)/);
    if (!seedMatch) {
      return res.status(400).json({ error: 'Seed string from replay is not in expected format' });
    }
    const seedPlayers = Number(seedMatch[1]);
    const seedSuffix = seedMatch[2];
    console.log('[validate-replay] seed parsed', { seedPlayers, seedSuffix });
    if (seedPlayers !== team.team_size) {
      return res.status(400).json({ error: `Replay is for ${seedPlayers}p but team is ${team.team_size}p` });
    }
    if (tpl.seed_payload && seedSuffix !== tpl.seed_payload) {
      return res.status(400).json({ error: `Replay seed ${seedSuffix} does not match template seed ${tpl.seed_payload}` });
    }

    // Stage 2: fetch history-full for first player and check variant/flags/score
    let historyData: any = null;
    if (exportPlayers.length > 0) {
      const player = exportPlayers[0];
      step = 'fetch history';
      historyData = await fetchJsonWithTimeout(
        `https://hanab.live/api/v1/history-full/${encodeURIComponent(player)}?start=${gameId}&end=${gameId}`,
      );
      console.log('[validate-replay] history fetched', {
        player,
        keys: historyData ? Object.keys(historyData) : [],
        array: Array.isArray(historyData),
      });
    }

    let historyVariant = null;
    let flagsOk = true;
    let score: number | null = null;
    let endCondition: number | null = null;
    let playedAt: string | null = null;

    // history-full returns an array for single-user queries. For multi-user it can be {games: []}
    const historyGames = Array.isArray(historyData)
      ? historyData
      : Array.isArray(historyData?.games)
        ? historyData.games
        : [];

    if (historyGames.length > 0) {
      const game = historyGames.find(
        (g: any) => String(g.id ?? g.gameId ?? g.game_id) === String(gameId),
      );
      if (game) {
        const opts = game.options ?? {};
        historyVariant = game.variantName ?? opts.variantName ?? game.variant ?? opts.variant;
        const flags = {
          cardCycle: game.cardCycle ?? opts.cardCycle,
          deckPlays: game.deckPlays ?? opts.deckPlays,
          emptyClues: game.emptyClues ?? opts.emptyClues,
          oneExtraCard: game.oneExtraCard ?? opts.oneExtraCard,
          oneLessCard: game.oneLessCard ?? opts.oneLessCard,
          allOrNothing: game.allOrNothing ?? opts.allOrNothing,
          detrimentalCharacters: game.detrimentalCharacters ?? opts.detrimentalCharacters,
        };
        flagsOk = Object.values(flags).every((v) => v === false || v === undefined);
        score = game.score ?? null;
        endCondition = game.endCondition ?? null;
        playedAt = game.datetimeFinished ?? game.datetimeFinishedUtc ?? game.datetime_finished ?? null;
      }
    }

    if (historyVariant && historyVariant !== tpl.variant) {
      return res.status(400).json({ error: `Replay variant ${historyVariant} does not match template variant ${tpl.variant}` });
    }
    if (!flagsOk) {
      return res.status(400).json({ error: 'Replay uses unsupported optional rules (flags should be false)' });
    }

    console.log('[validate-replay] success', {
      gameId,
      exportPlayers,
      seedString,
      derived: { seedSuffix, seedPlayers, historyVariant, score, endCondition, playedAt },
    });

    return res.json({
      ok: true,
      gameId,
      export: {
        players: exportPlayers,
        seed: seedString,
      },
      derived: {
        seedSuffix,
        teamSize: seedPlayers,
        variant: historyVariant ?? tpl.variant,
        score,
        endCondition,
        playedAt,
      },
    });
  } catch (err) {
    const e = err as { message?: string; code?: string; stack?: string };
    const message = e.message ?? 'Failed to validate replay';
    if (message === 'timeout') {
      return res
        .status(504)
        .json({ error: 'Validation timed out contacting hanab.live', code: 'TIMEOUT', details: message, step });
    }
      console.error('Error validating replay:', err);
      res.status(502).json({
        error: `Failed to validate replay: ${message}`,
        code: e.code ?? 'FETCH_FAILED',
        details: e.stack ?? String(err),
        step,
      });
  }
});

async function fetchJsonWithTimeout(url: string, ms = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      throw new Error(`Request failed (${resp.status})`);
    }
    return await resp.json();
  } catch (err) {
    if ((err as { name?: string }).name === 'AbortError') {
      throw new Error('timeout');
    }
    throw err;
  } finally {
    clearTimeout(id);
  }
}

function parseGameId(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  const matchUrl = trimmed.match(/(?:replay|shared-replay)\/(\d+)/i);
  const matchId = trimmed.match(/^\d+$/);
  return matchUrl ? matchUrl[1] : matchId ? matchId[0] : null;
}
/* ------------------------------------------
 *  POST /api/events  (ADMIN)
 * ----------------------------------------*/
router.post('/', authRequired, requireAdmin, async (req: Request, res: Response) => {
  const { name, slug, short_description, long_description, starts_at, ends_at } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!slug) return res.status(400).json({ error: 'slug is required' });
  if (!long_description) return res.status(400).json({ error: 'long_description is required' });
  if (starts_at && ends_at) {
    const startDate = new Date(starts_at);
    const endDate = new Date(ends_at);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format for starts_at or ends_at' });
    }
    if (endDate <= startDate) {
      return res.status(400).json({ error: 'ends_at must be after starts_at' });
    }
  }

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
