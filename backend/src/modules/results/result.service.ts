// src/modules/results/result.service.ts
import { pool } from '../../config/db';

export type ZeroReason = 'Strike Out' | 'Time Out' | 'VTK' | null;

export interface GameResultRow {
  id: number;
  team_enrollment_id: number;
  seed_id: number;
  game_id: number | null; // hanab.live id
  score: number;
  zero_reason: ZeroReason;
  bottom_deck_risk: number | null;
  notes: string | null;
  played_at: string;
  created_at: string;
}

export interface GameResultDetail extends GameResultRow {
  challenge_id: number;
  seed_number: number;
  team_id: number;
  team_name: string;
  player_count: number;
  players: string[]; // display names in seat order
}

/**
 * Create a game result: insert into games with result fields.
 * Assumes team_enrollment_id and seed_id are valid and
 * uniqueness (team_enrollment_id, seed_id) is enforced by the DB.
 */
export async function createGameResult(input: {
  team_enrollment_id: number;
  seed_id: number;
  game_id?: number | null; // hanab.live
  score: number;
  zero_reason?: ZeroReason;
  bottom_deck_risk?: number | null;
  notes?: string | null;
  played_at?: string | null;
}): Promise<GameResultRow> {
  const {
    team_enrollment_id,
    seed_id,
    game_id = null,
    score,
    zero_reason = null,
    bottom_deck_risk = null,
    notes = null,
    played_at = null,
  } = input;

  try {
    const result = await pool.query(
      `
      INSERT INTO games (
        team_enrollment_id,
        seed_id,
        game_id,
        score,
        zero_reason,
        bottom_deck_risk,
        notes,
        played_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, NOW()))
      RETURNING
        id,
        team_enrollment_id,
        seed_id,
        game_id,
        score,
        zero_reason,
        bottom_deck_risk,
        notes,
        played_at,
        created_at;
      `,
      [
        team_enrollment_id,
        seed_id,
        game_id,
        score,
        zero_reason,
        bottom_deck_risk,
        notes,
        played_at,
      ],
    );

    return result.rows[0];
  } catch (err) {
    if ((err as { code?: string }).code === '23505') {
      const e = new Error('A game result already exists for this team and seed');
      (e as { code?: string }).code = 'GAME_RESULT_EXISTS';
      throw e;
    }

    throw err;
  }
}

/**
 * Get a fully-hydrated result by games.id
 * (includes seed, team, players, etc.)
 */
export async function getGameResultById(id: number): Promise<GameResultDetail | null> {
  const result = await pool.query(
    `
    SELECT
      g.id,
      g.team_enrollment_id,
      g.seed_id,
      g.game_id,
      g.score,
      g.zero_reason,
      g.bottom_deck_risk,
      g.notes,
      g.played_at,
      g.created_at,
      cs.challenge_id,
      cs.seed_number,
      t.id AS team_id,
      t.name AS team_name,
      te.player_count,
      array_agg(u.display_name ORDER BY u.display_name) AS players
    FROM games g
    JOIN challenge_seeds cs ON cs.id = g.seed_id
    JOIN team_enrollments te ON te.id = g.team_enrollment_id
    JOIN teams t ON t.id = te.team_id
    JOIN game_participants gp ON gp.game_id = g.id
    JOIN users u ON u.id = gp.user_id
    WHERE g.id = $1
    GROUP BY
      g.id,
      g.team_enrollment_id,
      g.seed_id,
      g.game_id,
      g.score,
      g.zero_reason,
      g.bottom_deck_risk,
      g.notes,
      g.played_at,
      g.created_at,
      cs.challenge_id,
      cs.seed_number,
      t.id,
      t.name,
      te.player_count;
    `,
    [id],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0] as {
    players: unknown;
  } & Omit<GameResultDetail, 'players'>;

  // row.players may be a Postgres array parsed as JS array,
  // or a raw string like "{bob,carol,dave}" depending on pg settings.
  let players: string[];

  if (Array.isArray(row.players)) {
    players = row.players;
  } else if (typeof row.players === 'string') {
    players = row.players
      .replace(/^\{|\}$/g, '') // drop { }
      .split(',')
      .filter((p: string) => p.length > 0);
  } else {
    players = [];
  }

  return {
    ...row,
    players,
  } as GameResultDetail;
}
