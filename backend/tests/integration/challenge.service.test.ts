import { describe, it, expect, beforeEach } from 'vitest';
import { pool } from '../../src/config/db';
import {
  listChallenges,
  listChallengeSeeds,
  listChallengeTeams,
  createChallenge,
  createChallengeSeed,
  getChallengeBySlug,
} from '../../src/modules/challenges/challenge.service';

interface ChallengeServiceErrorShape {
  code: string;
}

describe('challenge.service (integration)', () => {
  const TEST_CHALLENGE_NAME = 'Unit Test Challenge';
  const TEST_CHALLENGE_SLUG = 'unit-test-challenge';

  beforeEach(async () => {
    await pool.query(
      `
      TRUNCATE
        games,
        game_participants,
        challenge_seeds,
        team_enrollments,
        team_memberships,
        teams,
        challenges,
        users
      RESTART IDENTITY CASCADE;
      `,
    );
  });

  it('listChallenges returns the challenges inserted in this test', async () => {
    const now = new Date().toISOString();

    await pool.query(
      `
      INSERT INTO challenges (name, slug, short_description, long_description, starts_at, ends_at)
      VALUES 
        ($1, $2, $3, $4, $5, $6),
        ($7, $8, $9, $10, $11, $12);
      `,
      [
        'No Variant 2025',
        'no-variant-2025',
        'short 2025',
        'long 2025',
        now,
        now,
        'No Variant 2026',
        'no-variant-2026',
        'short 2026',
        'long 2026',
        now,
        now,
      ],
    );

    const challenges = await listChallenges();
    const names = challenges.map((c) => c.name);

    expect(names).toContain('No Variant 2025');
    expect(names).toContain('No Variant 2026');
    expect(challenges.length).toBe(2);
  });

  it('listChallengeSeeds returns the seeds for the given challenge', async () => {
    const challengeRes = await pool.query(
      `
      INSERT INTO challenges (name, slug, short_description, long_description)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
      `,
      ['Seed Test Challenge', 'seed-test-challenge', 'short', 'long description for seeds test'],
    );
    const challengeId = challengeRes.rows[0].id as number;

    await pool.query(
      `
      INSERT INTO challenge_seeds (challenge_id, seed_number, variant, seed_payload)
      VALUES 
        ($1, 1, 'BASE', 'SEED-1'),
        ($1, 2, 'BASE', 'SEED-2'),
        ($1, 3, 'BASE', 'SEED-3'),
        ($1, 4, 'BASE', 'SEED-4'),
        ($1, 5, 'BASE', 'SEED-5');
      `,
      [challengeId],
    );

    const seeds = await listChallengeSeeds(challengeId);
    const payloads = seeds.map((s) => s.seed_payload);

    expect(seeds.length).toBe(5);
    expect(payloads).toEqual(
      expect.arrayContaining(['SEED-1', 'SEED-2', 'SEED-3', 'SEED-4', 'SEED-5']),
    );
  });

  it('listChallengeTeams returns the teams for the given challenge', async () => {
    const challengeRes = await pool.query(
      `
      INSERT INTO challenges (name, slug, short_description, long_description)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
      `,
      ['Teams Test Challenge', 'teams-test-challenge', 'short', 'long description for teams test'],
    );
    const challengeId = challengeRes.rows[0].id as number;

    await pool.query(
      `
      INSERT INTO teams (name, challenge_id)
      VALUES ($1, $2), ($3, $2)
      RETURNING id, name;
      `,
      ['Lanterns', challengeId, 'Clue Crew'],
    );

    const teams = await listChallengeTeams(challengeId);
    const names = teams.map((t) => t.name);

    expect(names).toContain('Lanterns');
    expect(names).toContain('Clue Crew');
  });

  it('createChallenge inserts a new challenge and rejects duplicates', async () => {
    const challenge = await createChallenge({
      name: TEST_CHALLENGE_NAME,
      slug: TEST_CHALLENGE_SLUG,
      short_description: 'unit test challenge (short)',
      long_description: 'unit test challenge (long description for testing)',
      starts_at: '2030-01-01T00:00:00Z',
      ends_at: '2030-12-31T23:59:59Z',
    });

    expect(challenge.id).toBeGreaterThan(0);
    expect(challenge.name).toBe(TEST_CHALLENGE_NAME);

    const expectedError: ChallengeServiceErrorShape = {
      code: 'CHALLENGE_NAME_EXISTS',
    };

    await expect(
      createChallenge({
        name: TEST_CHALLENGE_NAME,
        slug: TEST_CHALLENGE_SLUG,
        short_description: 'duplicate (short)',
        long_description: 'duplicate (long)',
      }),
    ).rejects.toMatchObject(expectedError);
  });

  it('createChallengeSeed inserts a new seed and rejects duplicates', async () => {
    const challenge = await createChallenge({
      name: TEST_CHALLENGE_NAME,
      slug: TEST_CHALLENGE_SLUG,
      short_description: 'seed parent',
      long_description: 'seed parent long description',
    });

    const seed = await createChallengeSeed(challenge.id, {
      seed_number: 99,
      variant: 'UNIT',
      seed_payload: 'UNIT-TEST-SEED',
    });

    expect(seed.id).toBeGreaterThan(0);
    expect(seed.challenge_id).toBe(challenge.id);
    expect(seed.seed_number).toBe(99);

    const expectedError: ChallengeServiceErrorShape = {
      code: 'CHALLENGE_SEED_EXISTS',
    };

    await expect(
      createChallengeSeed(challenge.id, {
        seed_number: 99,
        variant: 'UNIT',
        seed_payload: 'UNIT-TEST-SEED-2',
      }),
    ).rejects.toMatchObject(expectedError);
  });

  it('getChallengeBySlug returns a challenge created in this test', async () => {
    const now = new Date().toISOString();
    const slug = 'no-var-2025';

    await pool.query(
      `
      INSERT INTO challenges (name, slug, short_description, long_description, starts_at, ends_at)
      VALUES ($1, $2, $3, $4, $5, $6);
      `,
      ['No Variant 2025', slug, 'short desc', 'Long description text', now, now],
    );

    const challenge = await getChallengeBySlug(slug);

    expect(challenge).not.toBeNull();
    expect(challenge?.slug).toBe(slug);
    expect(challenge?.name).toBe('No Variant 2025');
    expect(challenge?.long_description).toBeTruthy();
  });

  it('getChallengeBySlug returns null when slug does not exist', async () => {
    const challenge = await getChallengeBySlug('this-slug-does-not-exist');
    expect(challenge).toBeNull();
  });
});
