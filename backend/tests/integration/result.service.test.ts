import { describe, it, expect, beforeEach } from 'vitest';
import { pool } from '../../src/config/db';
import {
  createGameResult,
  getGameResultById,
  ZeroReason,
} from '../../src/modules/results/result.service';

interface GameResultErrorShape {
  code: string;
}

describe('result.service (games, integration)', () => {
  beforeEach(async () => {
    await pool.query(
      `
      TRUNCATE
        game_participants,
        games,
        challenge_seeds,
        team_memberships,
        teams,
        challenges,
        users
      RESTART IDENTITY CASCADE;
      `,
    );
  });

  async function setupChallengeSeedTeamAndUsers() {
    // Challenge
    const challengeRes = await pool.query(
      `
      INSERT INTO challenges (name, slug, short_description, long_description)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
      `,
      [
        'Result Test Challenge',
        'result-test-challenge',
        'short desc',
        'long description for result tests',
      ],
    );
    const challengeId = challengeRes.rows[0].id as number;

    // Seed
    const seedRes = await pool.query(
      `
      INSERT INTO challenge_seeds (challenge_id, seed_number, variant, seed_payload)
      VALUES ($1, $2, $3, $4)
      RETURNING id, seed_number;
      `,
      [challengeId, 1, 'NO_VARIANT', 'RESULT-TEST-SEED-1'],
    );
    const seedId = seedRes.rows[0].id as number;
    const seedNumber = seedRes.rows[0].seed_number as number;

    // Team (3-player team for this test)
    const teamRes = await pool.query(
      `
      INSERT INTO teams (name, challenge_id, team_size)
      VALUES ($1, $2, 3)
      RETURNING id, name, team_size;
      `,
      ['Lanterns', challengeId],
    );
    const teamId = teamRes.rows[0].id as number;
    const teamName = teamRes.rows[0].name as string;
    const teamSize = teamRes.rows[0].team_size as number;

    // Users / players
    const playersRes = await pool.query(
      `
      INSERT INTO users (display_name, password_hash, role)
      VALUES
        ('bob',   'dummy-hash', 'USER'),
        ('carol', 'dummy-hash', 'USER'),
        ('dave',  'dummy-hash', 'USER')
      RETURNING id, display_name;
      `,
    );
    const playerIds = playersRes.rows.map((r) => r.id as number);
    const playerNames = playersRes.rows.map((r) => r.display_name as string);

    // In the new schema, player_count comes from teams.team_size.
    const playerCount = teamSize;

    return {
      challengeId,
      seedId,
      seedNumber,
      teamId,
      teamName,
      playerIds,
      playerNames,
      playerCount,
      teamSize,
    };
  }

  it('getGameResultById returns hydrated result for an existing game', async () => {
    const {
      challengeId,
      seedId,
      seedNumber,
      teamId,
      teamName,
      playerIds,
      playerNames,
      playerCount,
    } = await setupChallengeSeedTeamAndUsers();

    // Create a game using the service under test
    const created = await createGameResult({
      team_id: teamId,
      seed_id: seedId,
      game_id: 1234,
      score: 25,
      zero_reason: null,
      bottom_deck_risk: 3,
      notes: 'Hydration test game',
      played_at: '2030-01-01T20:00:00Z',
    });

    // Seed participants directly into game_participants
    for (const userId of playerIds) {
      await pool.query(
        `
        INSERT INTO game_participants (game_id, user_id)
        VALUES ($1, $2);
        `,
        [created.id, userId],
      );
    }

    const detail = await getGameResultById(created.id);

    expect(detail).not.toBeNull();
    if (!detail) return;

    expect(detail.id).toBe(created.id);
    expect(detail.score).toBe(25);
    expect(detail.zero_reason).toBeNull();

    expect(detail.challenge_id).toBe(challengeId);
    expect(detail.seed_number).toBe(seedNumber);
    expect(detail.team_name).toBe(teamName);
    expect(detail.player_count).toBe(playerCount);

    const playersSorted = [...detail.players].sort();
    expect(playersSorted).toEqual(playerNames.slice().sort());
  });

  it('createGameResult inserts a new game record for a fresh (team, seed) pair', async () => {
    const { seedId, teamId } = await setupChallengeSeedTeamAndUsers();

    const row = await createGameResult({
      team_id: teamId,
      seed_id: seedId,
      game_id: 9999,
      score: 19,
      zero_reason: 'Time Out' as ZeroReason,
      bottom_deck_risk: 4,
      notes: 'Unit test game result',
      played_at: '2030-05-01T20:00:00Z',
    });

    expect(row.id).toBeGreaterThan(0);
    expect(row.team_id).toBe(teamId);
    expect(row.seed_id).toBe(seedId);
    expect(row.score).toBe(19);
    expect(row.zero_reason).toBe('Time Out');
    expect(row.bottom_deck_risk).toBe(4);

    const dbCheck = await pool.query(
      `
      SELECT score, zero_reason, bottom_deck_risk, notes
      FROM games
      WHERE id = $1
      `,
      [row.id],
    );
    expect(dbCheck.rowCount).toBe(1);
    expect(dbCheck.rows[0].score).toBe(19);
    expect(dbCheck.rows[0].zero_reason).toBe('Time Out');
    expect(dbCheck.rows[0].bottom_deck_risk).toBe(4);
    expect(dbCheck.rows[0].notes).toBe('Unit test game result');
  });

  it('createGameResult rejects duplicate (team, seed) with GAME_RESULT_EXISTS', async () => {
    const { seedId, teamId } = await setupChallengeSeedTeamAndUsers();

    const first = await createGameResult({
      team_id: teamId,
      seed_id: seedId,
      game_id: 10001,
      score: 10,
      zero_reason: null,
    });
    expect(first.id).toBeGreaterThan(0);

    const expectedError: GameResultErrorShape = {
      code: 'GAME_RESULT_EXISTS',
    };

    await expect(
      createGameResult({
        team_id: teamId,
        seed_id: seedId,
        game_id: 10002,
        score: 5,
        zero_reason: null,
      }),
    ).rejects.toMatchObject(expectedError);
  });
});
