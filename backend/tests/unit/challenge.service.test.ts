// backend/tests/unit/challenge.service.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../../src/config/db';
import {
  listChallenges,
  listChallengeSeeds,
  listChallengeTeams,
  createChallenge,
  createChallengeSeed,
} from '../../src/modules/challenges/challenge.service';

interface ChallengeServiceErrorShape {
  code: string;
}

describe('challenge.service', () => {
  const TEST_CHALLENGE_NAME = 'Unit Test Challenge';
  let testChallengeId: number | null = null;
  let testSeedId: number | null = null;

  beforeAll(async () => {
    // Clean up any leftovers from prior runs
    const seedRes = await pool.query(
      "DELETE FROM challenge_seeds WHERE seed_payload = 'UNIT-TEST-SEED' RETURNING challenge_id",
    );
    if (seedRes.rowCount > 0) {
      testChallengeId = seedRes.rows[0].challenge_id;
    }
    await pool.query('DELETE FROM challenges WHERE name = $1', [TEST_CHALLENGE_NAME]);
  });

  afterAll(async () => {
    if (testSeedId != null) {
      await pool.query('DELETE FROM challenge_seeds WHERE id = $1', [testSeedId]);
    }
    await pool.query('DELETE FROM challenges WHERE name = $1', [TEST_CHALLENGE_NAME]);
  });

  it('listChallenges returns the seeded challenges', async () => {
    const challenges = await listChallenges();

    // We know sample_data.sql created these two:
    const names = challenges.map((c) => c.name);

    expect(names).toContain('No Variant 2025');
    expect(names).toContain('No Variant 2026');
    expect(challenges.length).toBeGreaterThanOrEqual(2);
  });

  it('listChallengeSeeds returns at least the 5 base seeds for challenge 1', async () => {
    const seeds = await listChallengeSeeds(1);

    // We know 5 base seeds exist; tests may add more (like seed_number 99)
    expect(seeds.length).toBeGreaterThanOrEqual(5);

    const payloads = seeds.map((s) => s.seed_payload);
    expect(payloads).toEqual(
      expect.arrayContaining(['NVC2025-1', 'NVC2025-2', 'NVC2025-3', 'NVC2025-4', 'NVC2025-5']),
    );
  });

  it('listChallengeTeams returns the teams for challenge 1', async () => {
    const teams = await listChallengeTeams(1);

    const names = teams.map((t) => t.name);
    expect(names).toContain('Lanterns');
    expect(names).toContain('Clue Crew');
  });

  it('createChallenge inserts a new challenge and rejects duplicates', async () => {
    // First create should succeed
    const challenge = await createChallenge({
      name: TEST_CHALLENGE_NAME,
      description: 'unit test challenge',
      starts_at: '2030-01-01T00:00:00Z',
      ends_at: '2030-12-31T23:59:59Z',
    });

    expect(challenge.id).toBeGreaterThan(0);
    expect(challenge.name).toBe(TEST_CHALLENGE_NAME);
    testChallengeId = challenge.id;

    // Second create with same name should fail with CHALLENGE_NAME_EXISTS
    const expectedError: ChallengeServiceErrorShape = {
      code: 'CHALLENGE_NAME_EXISTS',
    };

    await expect(
      createChallenge({
        name: TEST_CHALLENGE_NAME,
        description: 'duplicate',
      }),
    ).rejects.toMatchObject(expectedError);
  });

  it('createChallengeSeed inserts a new seed and rejects duplicates', async () => {
    if (!testChallengeId) {
      throw new Error('Test challenge not created');
    }

    const seed = await createChallengeSeed(testChallengeId, {
      seed_number: 99,
      variant: 'UNIT',
      seed_payload: 'UNIT-TEST-SEED',
    });

    expect(seed.id).toBeGreaterThan(0);
    expect(seed.challenge_id).toBe(testChallengeId);
    expect(seed.seed_number).toBe(99);
    testSeedId = seed.id;

    // Second insert with same challenge + seed_number should fail
    const expectedError: ChallengeServiceErrorShape = {
      code: 'CHALLENGE_SEED_EXISTS',
    };

    await expect(
      createChallengeSeed(testChallengeId, {
        seed_number: 99,
        variant: 'UNIT',
        seed_payload: 'UNIT-TEST-SEED-2',
      }),
    ).rejects.toMatchObject(expectedError);
  });
});
