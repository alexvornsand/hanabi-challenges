// src/modules/results/result.service.ts
import { pool } from '../../config/db';

export type ZeroReason = 'Strike Out' | 'Time Out' | 'VTK' | null;

export interface GameResultRow {
  id: number;
  event_team_id: number;
  event_game_template_id: number;
  game_id: number | null; // hanab.live id
  score: number;
  zero_reason: ZeroReason;
  bottom_deck_risk: number | null;
  notes: string | null;
  played_at: string;
  created_at: string;
}

export interface GameResultDetail extends GameResultRow {
  event_id: number;
  event_stage_id: number;
  stage_index: number;
  stage_label: string;
  stage_type: 'SINGLE' | 'ROUND_ROBIN' | 'BRACKET' | 'GAUNTLET';
  template_index: number;
  event_team_name: string;
  player_count: number;
  players: string[]; // display names in seat order
}

/**
 * Create a game result: insert into games with result fields.
 * Assumes event_team_id and event_game_template_id are valid and
 * uniqueness (event_team_id, event_game_template_id) is enforced by the DB.
 */
export async function createGameResult(input: {
  event_team_id: number;
  event_game_template_id: number;
  game_id?: number | null; // hanab.live
  score: number;
  zero_reason?: ZeroReason;
  bottom_deck_risk?: number | null;
  notes?: string | null;
  played_at?: string | null;
}): Promise<GameResultRow> {
  const {
    event_team_id,
    event_game_template_id,
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
      INSERT INTO event_games (
        event_team_id,
        event_game_template_id,
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
        event_team_id,
        event_game_template_id,
        game_id,
        score,
        zero_reason,
        bottom_deck_risk,
        notes,
        played_at,
        created_at;
      `,
      [
        event_team_id,
        event_game_template_id,
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
      const e = new Error('A game result already exists for this team and template');
      (e as { code?: string }).code = 'GAME_RESULT_EXISTS';
      throw e;
    }

    throw err;
  }
}

/**
 * Get a fully-hydrated result by games.id
 * (includes template, team, players, etc.)
 */
export async function getGameResultById(id: number): Promise<GameResultDetail | null> {
  const result = await pool.query(
    `
    SELECT
      g.id,
      g.event_team_id,
      g.event_game_template_id,
      g.game_id,
      g.score,
      g.zero_reason,
      g.bottom_deck_risk,
      g.notes,
      g.played_at,
      g.created_at,
      es.event_id,
      es.event_stage_id,
      es.stage_index,
      es.label AS stage_label,
      es.stage_type,
      egt.template_index,
      t.name AS event_team_name,
      t.team_size AS player_count,
      array_remove(array_agg(u.display_name ORDER BY u.display_name), NULL) AS players
    FROM event_games g
    JOIN event_game_templates egt ON egt.id = g.event_game_template_id
    JOIN event_stages es ON es.event_stage_id = egt.event_stage_id
    JOIN event_teams t ON t.id = g.event_team_id
    LEFT JOIN game_participants gp ON gp.event_game_id = g.id
    LEFT JOIN users u ON u.id = gp.user_id
    WHERE g.id = $1
    GROUP BY
      g.id,
      g.event_team_id,
      g.event_game_template_id,
      g.game_id,
      g.score,
      g.zero_reason,
      g.bottom_deck_risk,
      g.notes,
      g.played_at,
      g.created_at,
      es.event_id,
      es.event_stage_id,
      es.stage_index,
      es.label,
      es.stage_type,
      egt.template_index,
      t.name,
      t.team_size;
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
