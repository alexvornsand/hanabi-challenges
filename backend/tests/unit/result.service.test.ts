// backend/tests/unit/result.service.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../../src/config/db';
import {
  createGameResult,
  getGameResultById,
  ZeroReason,
} from '../../src/modules/results/result.service';

interface GameResultErrorShape {
  code: string;
}

describe('result.service (games)', () => {
  let testSeedId: number | null = null;

  beforeAll(async () => {
    // Clean up any leftover unit-test seed
    const res = await pool.query(
      "SELECT id FROM challenge_seeds WHERE seed_payload = 'UNIT-TEST-GAME-SEED'",
    );
    if (res.rowCount > 0) {
      const id = res.rows[0].id;
      await pool.query('DELETE FROM games WHERE seed_id = $1', [id]);
      await pool.query('DELETE FROM challenge_seeds WHERE id = $1', [id]);
    }

    // Insert fresh seed for challenge 1 with seed_number 99
    const insert = await pool.query(
      `
      INSERT INTO challenge_seeds (challenge_id, seed_number, variant, seed_payload)
      VALUES (1, 99, 'NO_VARIANT', 'UNIT-TEST-GAME-SEED')
      RETURNING id;
      `,
    );
    testSeedId = insert.rows[0].id;
  });

  afterAll(async () => {
    if (testSeedId != null) {
      await pool.query('DELETE FROM games WHERE seed_id = $1', [testSeedId]);
      await pool.query('DELETE FROM challenge_seeds WHERE id = $1', [testSeedId]);
    }
  });

  it('getGameResultById returns hydrated result for an existing game', async () => {
    // From sample_data:
    // game_id (PK) 1 is Lanterns 3p, challenge 1, seed_id 1, score 25, zero_reason NULL
    const detail = await getGameResultById(1);

    expect(detail).not.toBeNull();
    if (!detail) return; // TS narrow

    expect(detail.id).toBe(1);
    expect(detail.score).toBe(25);
    expect(detail.zero_reason).toBeNull();

    // Hydrated fields
    expect(detail.challenge_id).toBe(1);
    expect(detail.seed_number).toBe(1);
    expect(detail.team_name).toBe('Lanterns');
    expect(detail.player_count).toBe(3);

    // Players should include bob, carol, dave (order not important)
    const playersSorted = [...detail.players].sort();
    expect(playersSorted).toEqual(['bob', 'carol', 'dave'].sort());
  });

  it('createGameResult inserts a new game record for a fresh (team_enrollment, seed) pair', async () => {
    if (!testSeedId) {
      throw new Error('Test seed not created');
    }

    // Use team_enrollment_id 1 (Lanterns 3p) with our new seed 99
    const row = await createGameResult({
      team_enrollment_id: 1,
      seed_id: testSeedId,
      game_id: 9999,
      score: 19,
      zero_reason: 'Time Out' as ZeroReason,
      bottom_deck_risk: 4,
      notes: 'Unit test game result',
      played_at: '2030-05-01T20:00:00Z',
    });

    expect(row.id).toBeGreaterThan(0);
    expect(row.team_enrollment_id).toBe(1);
    expect(row.seed_id).toBe(testSeedId);
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

  it('createGameResult rejects duplicate (team_enrollment, seed) with GAME_RESULT_EXISTS', async () => {
    if (!testSeedId) {
      throw new Error('Test seed not created');
    }

    // We already created a game for (1, testSeedId) in the previous test.
    const expectedError: GameResultErrorShape = {
      code: 'GAME_RESULT_EXISTS',
    };

    await expect(
      createGameResult({
        team_enrollment_id: 1,
        seed_id: testSeedId,
        game_id: 10000,
        score: 10,
        zero_reason: null,
      }),
    ).rejects.toMatchObject(expectedError);
  });
});
