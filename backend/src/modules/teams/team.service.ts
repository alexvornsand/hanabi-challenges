// src/modules/teams/team.service.ts
import { pool } from '../../config/db';

export type TeamRole = 'PLAYER' | 'STAFF';

export interface EventTeam {
  id: number;
  event_id: number;
  name: string;
  team_size: number;
  created_at: string;
}

export interface EventTeamDetail extends EventTeam {
  event_slug: string;
  event_name: string;
}

export interface TeamMember {
  id: number;
  event_team_id: number;
  user_id: number;
  role: TeamRole;
  is_listed: boolean;
  created_at: string;
  display_name: string;
  color_hex: string;
  text_color: string;
}

export interface PendingTeamMember {
  id: number;
  event_team_id: number;
  display_name: string;
  role: TeamRole;
  created_at: string;
}

export interface MemberCandidate {
  id: number;
  display_name: string;
}

export interface TeamGameSummary {
  id: number;
  event_game_template_id: number;
  game_id: number | null;
  score: number;
  zero_reason: string | null;
  bottom_deck_risk: number | null;
  notes: string | null;
  played_at: string;
  event_stage_id: number;
  stage_index: number;
  stage_label: string;
  stage_type: 'SINGLE' | 'ROUND_ROBIN' | 'BRACKET' | 'GAUNTLET';
  template_index: number;
  variant: string;
  players: {
    display_name: string;
    color_hex: string;
    text_color: string;
  }[];
}

// List members of a team
export async function listTeamMembers(eventTeamId: number): Promise<TeamMember[]> {
  const result = await pool.query(
    `
    SELECT
      tm.id,
      tm.event_team_id,
      tm.user_id,
      tm.role,
      tm.is_listed,
      tm.created_at,
      u.display_name,
      u.color_hex,
      u.text_color
    FROM team_memberships tm
    JOIN users u ON tm.user_id = u.id
    WHERE tm.event_team_id = $1
    ORDER BY tm.id;
    `,
    [eventTeamId],
  );

  return result.rows;
}

// Create a new event team
export async function createEventTeam(input: {
  event_id: number;
  name: string;
  team_size: number;
}): Promise<EventTeam> {
  const { event_id, name, team_size } = input;

  try {
    const teamResult = await pool.query(
      `
      INSERT INTO event_teams (event_id, name, team_size)
      VALUES ($1, $2, $3)
      RETURNING id, event_id, name, team_size, created_at;
      `,
      [event_id, name, team_size],
    );

    return teamResult.rows[0];
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      const e = new Error('Team name must be unique within the event');
      (e as { code?: string }).code = 'TEAM_CREATE_CONFLICT';
      throw e;
    }

    throw err;
  }
}

// Create a team and add the creator as STAFF
export async function createEventTeamWithCreator(input: {
  event_id: number;
  name: string;
  team_size: number;
  creator_user_id: number;
}): Promise<EventTeam> {
  const { event_id, name, team_size, creator_user_id } = input;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const teamResult = await client.query(
      `
      INSERT INTO event_teams (event_id, name, team_size)
      VALUES ($1, $2, $3)
      RETURNING id, event_id, name, team_size, created_at;
      `,
      [event_id, name, team_size],
    );

    const team = teamResult.rows[0];

    await client.query(
      `
      INSERT INTO team_memberships (event_team_id, user_id, role, is_listed)
      VALUES ($1, $2, 'STAFF', true)
      ON CONFLICT DO NOTHING;
      `,
      [team.id, creator_user_id],
    );

    await client.query('COMMIT');
    return team;
  } catch (err) {
    await client.query('ROLLBACK');

    if ((err as { code?: string }).code === '23505') {
      const e = new Error('Team name must be unique within the event');
      (e as { code?: string }).code = 'TEAM_CREATE_CONFLICT';
      throw e;
    }

    throw err;
  } finally {
    client.release();
  }
}

// Add a member (PLAYER or STAFF) to a team
export async function addTeamMember(input: {
  event_team_id: number;
  user_id: number;
  role: TeamRole;
  is_listed: boolean;
}): Promise<TeamMember> {
  const { event_team_id, user_id, role, is_listed } = input;

  try {
    const result = await pool.query(
      `
      INSERT INTO team_memberships (event_team_id, user_id, role, is_listed)
      VALUES ($1, $2, $3, $4)
      RETURNING id, event_team_id, user_id, role, is_listed, created_at;
      `,
      [event_team_id, user_id, role, is_listed],
    );

    // Attach display_name via a follow-up query, or leave it out here.
    const memberRow = result.rows[0];

    const userResult = await pool.query(
      `
      SELECT display_name
      FROM users
      WHERE id = $1;
      `,
      [memberRow.user_id],
    );

    const display_name = userResult.rows[0]?.display_name ?? '';

    return {
      ...memberRow,
      display_name,
    };
  } catch (err) {
    if (err.code === '23505') {
      const e = new Error('This user already has this role on the team');
      (e as { code?: string }).code = 'TEAM_MEMBER_EXISTS';
      throw e;
    }

    throw err;
  }
}

export async function addPendingTeamMember(input: {
  event_team_id: number;
  display_name: string;
  role: TeamRole;
}): Promise<PendingTeamMember> {
  const { event_team_id, display_name, role } = input;

  const result = await pool.query(
    `
    INSERT INTO pending_team_members (event_team_id, display_name, role)
    VALUES ($1, $2, $3)
    RETURNING id, event_team_id, display_name, role, created_at;
    `,
    [event_team_id, display_name, role],
  );

  return result.rows[0];
}

// List candidate members for a team (users not yet on team, optional prefix filter)
export async function listMemberCandidates(
  eventTeamId: number,
  query: string | null,
): Promise<MemberCandidate[]> {
  let q = (query ?? '').trim();
  if (q.startsWith('@')) {
    q = q.slice(1);
  }

  if (q.length === 0) {
    const result = await pool.query(
      `
      SELECT
        u.id,
        u.display_name
      FROM users u
      WHERE u.id NOT IN (
        SELECT tm.user_id
      FROM team_memberships tm
      WHERE tm.event_team_id = $1
      )
      ORDER BY u.display_name;
      `,
      [eventTeamId],
    );

    return result.rows;
  }

  const result = await pool.query(
    `
    SELECT
      u.id,
      u.display_name
    FROM users u
    WHERE
      u.display_name ILIKE $1
      AND u.id NOT IN (
        SELECT tm.user_id
        FROM team_memberships tm
        WHERE tm.event_team_id = $2
      )
    ORDER BY u.display_name;
    `,
    [q + '%', eventTeamId],
  );

  return result.rows;
}

// Get the basic detail for an event team (includes event slug/name)
export async function getEventTeamDetail(eventTeamId: number): Promise<EventTeamDetail | null> {
  const result = await pool.query(
    `
    SELECT
      t.id,
      t.event_id,
      t.name,
      t.team_size,
      t.created_at,
      e.slug AS event_slug,
      e.name AS event_name
    FROM event_teams t
    JOIN events e ON e.id = t.event_id
    WHERE t.id = $1;
    `,
    [eventTeamId],
  );

  if (result.rowCount === 0) return null;

  return result.rows[0] as EventTeamDetail;
}

// List completed games for a team, grouped by stage in the query order
export async function listTeamGames(eventTeamId: number): Promise<TeamGameSummary[]> {
  const result = await pool.query(
    `
    SELECT
      g.id,
      g.event_game_template_id,
      g.game_id,
      g.score,
      g.zero_reason,
      g.bottom_deck_risk,
      g.notes,
      g.played_at,
      es.event_stage_id,
      es.stage_index,
      es.label AS stage_label,
      es.stage_type,
      egt.template_index,
      egt.variant,
      COALESCE(
        json_agg(
          json_build_object(
            'display_name', u.display_name,
            'color_hex', u.color_hex,
            'text_color', u.text_color
          )
          ORDER BY u.display_name
        ) FILTER (WHERE u.id IS NOT NULL),
        '[]'::json
      ) AS players
    FROM event_games g
    JOIN event_game_templates egt ON egt.id = g.event_game_template_id
    JOIN event_stages es ON es.event_stage_id = egt.event_stage_id
    LEFT JOIN game_participants gp ON gp.event_game_id = g.id
    LEFT JOIN users u ON u.id = gp.user_id
    WHERE g.event_team_id = $1
    GROUP BY
      g.id,
      g.event_game_template_id,
      g.game_id,
      g.score,
      g.zero_reason,
      g.bottom_deck_risk,
      g.notes,
      g.played_at,
      es.event_stage_id,
      es.stage_index,
      es.label,
      es.stage_type,
      egt.template_index,
      egt.variant
    ORDER BY es.stage_index, egt.template_index, g.id;
    `,
    [eventTeamId],
  );

  return result.rows.map((row) => {
    return { ...row, players: row.players ?? [] } as TeamGameSummary;
  });
}
