// src/modules/challenges/challenge.service.ts
import { pool } from '../../config/db';

export class ChallengeNameExistsError extends Error {
  code = 'CHALLENGE_NAME_EXISTS';
}

export class ChallengeSeedExistsError extends Error {
  code = 'CHALLENGE_SEED_EXISTS';
}

export interface Challenge {
  id: number;
  slug: string;
  name: string;
  short_description: string | null;
  long_description: string;
  starts_at: string | null;
  ends_at: string | null;
}

export interface ChallengeSeed {
  id: number;
  challenge_id: number;
  seed_number: number;
  variant: string | null;
  seed_payload: string | null;
  created_at: string;
}

export interface ChallengeTeam {
  id: number;
  name: string;
  created_by_user_id: number;
  created_at: string;
}

export interface ChallengeDetail {
  id: number;
  slug: string;
  name: string;
  short_description: string | null;
  long_description: string;
  starts_at: string | null;
  ends_at: string | null;
}

export interface CreateChallengeInput {
  name: string;
  slug: string;
  short_description?: string | null;
  long_description: string;
  starts_at?: string | null;
  ends_at?: string | null;
}

/* ------------------------------------------
 * List all challenges
 * ----------------------------------------*/
export async function listChallenges(): Promise<Challenge[]> {
  const result = await pool.query<Challenge>(
    `
    SELECT
      id,
      slug,
      name,
      short_description,
      long_description,
      starts_at,
      ends_at
    FROM challenges
    ORDER BY starts_at NULLS LAST, id
    `
  );

  return result.rows;
}

/* ------------------------------------------
 * Create a new challenge
 * ----------------------------------------*/
export async function createChallenge(input: CreateChallengeInput) {
  const { name, slug, short_description, long_description, starts_at, ends_at } = input;

  if (!slug) {
    throw { code: 'CHALLENGE_SLUG_REQUIRED' } as { code: string };
  }
  if (!long_description) {
    throw { code: 'CHALLENGE_LONG_DESCRIPTION_REQUIRED' } as { code: string };
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO challenges (name, slug, short_description, long_description, starts_at, ends_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, slug, short_description, long_description, starts_at, ends_at, created_at;
      `,
      [name, slug, short_description ?? null, long_description, starts_at, ends_at]
    );

    return result.rows[0];
  } catch (err: any) {
    if (err.code === '23505') {
      throw new ChallengeNameExistsError('Challenge name or slug must be unique');
    }
    throw err;
  }
}

/* ------------------------------------------
 * Internal: Find challenge ID by slug
 * ----------------------------------------*/
async function getChallengeIdBySlug(slug: string): Promise<number | null> {
  const result = await pool.query<{ id: number }>(
    `SELECT id FROM challenges WHERE slug = $1`,
    [slug]
  );
  return result.rowCount > 0 ? result.rows[0].id : null;
}

/* ------------------------------------------
 * Get a challenge by slug
 * ----------------------------------------*/
export async function getChallengeBySlug(slug: string): Promise<ChallengeDetail | null> {
  const result = await pool.query<ChallengeDetail>(
    `
    SELECT
      id,
      slug,
      name,
      short_description,
      long_description,
      starts_at,
      ends_at
    FROM challenges
    WHERE slug = $1
    `,
    [slug]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
}

/* ------------------------------------------
 * Old: list seeds by numeric ID (still used internally)
 * ----------------------------------------*/
export async function listChallengeSeeds(challengeId: number): Promise<ChallengeSeed[]> {
  const result = await pool.query(
    `
    SELECT
      cs.id,
      cs.challenge_id,
      cs.seed_number,
      cs.variant,
      cs.seed_payload,
      cs.created_at
    FROM challenge_seeds cs
    WHERE cs.challenge_id = $1
    ORDER BY cs.seed_number;
    `,
    [challengeId]
  );

  return result.rows;
}

/* ------------------------------------------
 * New: list seeds by SLUG
 * ----------------------------------------*/
export async function listChallengeSeedsBySlug(slug: string): Promise<ChallengeSeed[]> {
  const challengeId = await getChallengeIdBySlug(slug);
  if (!challengeId) return [];
  return listChallengeSeeds(challengeId);
}

/* ------------------------------------------
 * Old: create seed using challenge ID
 * ----------------------------------------*/
export async function createChallengeSeed(
  challengeId: number,
  input: {
    seed_number: number;
    variant?: string | null;
    seed_payload?: string | null;
  }
): Promise<ChallengeSeed> {
  const { seed_number, variant = null, seed_payload = null } = input;

  try {
    const result = await pool.query(
      `
      INSERT INTO challenge_seeds (challenge_id, seed_number, variant, seed_payload)
      VALUES ($1, $2, $3, $4)
      RETURNING id, challenge_id, seed_number, variant, seed_payload, created_at;
      `,
      [challengeId, seed_number, variant, seed_payload]
    );

    return result.rows[0];
  } catch (err: any) {
    if (err.code === '23505') {
      throw new ChallengeSeedExistsError('Seed already exists for this challenge with that number');
    }
    throw err;
  }
}

/* ------------------------------------------
 * New: create seed by SLUG
 * ----------------------------------------*/
export async function createChallengeSeedBySlug(
  slug: string,
  input: {
    seed_number: number;
    variant?: string | null;
    seed_payload?: string | null;
  }
): Promise<ChallengeSeed> {
  const challengeId = await getChallengeIdBySlug(slug);
  if (!challengeId) {
    throw new Error(`Unknown challenge slug: ${slug}`);
  }

  return createChallengeSeed(challengeId, input);
}

/* ------------------------------------------
 * Old: list teams by numeric ID
 * ----------------------------------------*/
export async function listChallengeTeams(challengeId: number): Promise<ChallengeTeam[]> {
  const result = await pool.query(
    `
    SELECT
      t.id,
      t.name,
      t.created_by_user_id,
      t.created_at
    FROM teams t
    WHERE t.challenge_id = $1
    ORDER BY t.id;
    `,
    [challengeId]
  );

  return result.rows;
}

/* ------------------------------------------
 * New: list teams by SLUG
 * ----------------------------------------*/
export async function listChallengeTeamsBySlug(slug: string): Promise<ChallengeTeam[]> {
  const challengeId = await getChallengeIdBySlug(slug);
  if (!challengeId) return [];
  return listChallengeTeams(challengeId);
}
