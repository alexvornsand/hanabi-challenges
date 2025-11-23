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

export interface TeamMember {
  id: number;
  event_team_id: number;
  user_id: number;
  role: TeamRole;
  is_listed: boolean;
  created_at: string;
  display_name: string;
}

export interface MemberCandidate {
  id: number;
  display_name: string;
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
      u.display_name
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
