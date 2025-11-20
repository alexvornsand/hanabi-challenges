// src/modules/challenges/challenge.routes.ts
import { Router, Request, Response } from 'express';
import { authRequired, requireAdmin } from '../../middleware/authMiddleware';
import {
  listChallenges,
  createChallenge,
  listChallengeSeedsBySlug,
  createChallengeSeedBySlug,
  listChallengeTeamsBySlug,
  getChallengeBySlug,
} from './challenge.service';

const router = Router();

/* ------------------------------------------
 *  GET /api/challenges
 * ----------------------------------------*/
router.get('/', async (_req: Request, res: Response) => {
  try {
    const challenges = await listChallenges();
    res.json(challenges);
  } catch (err) {
    console.error('Error fetching challenges:', err);
    res.status(500).json({ error: 'Failed to fetch challenges' });
  }
});

/* ------------------------------------------
 *  POST /api/challenges  (ADMIN)
 * ----------------------------------------*/
router.post('/', authRequired, requireAdmin, async (req: Request, res: Response) => {
  const { name, slug, short_description, long_description, starts_at, ends_at } = req.body;

  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!slug) return res.status(400).json({ error: 'slug is required' });
  if (!long_description) return res.status(400).json({ error: 'long_description is required' });

  try {
    const challenge = await createChallenge({
      name,
      slug,
      short_description: short_description ?? null,
      long_description,
      starts_at: starts_at ?? null,
      ends_at: ends_at ?? null,
    });

    res.status(201).json(challenge);
  } catch (err) {
    if (err.code === 'CHALLENGE_NAME_EXISTS') {
      return res.status(409).json({ error: 'Challenge name must be unique' });
    }
    console.error('Error creating challenge:', err);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

/* ------------------------------------------
 *  GET /api/challenges/:slug
 * ----------------------------------------*/
router.get('/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;

  if (!slug) {
    res.status(400).json({ error: 'slug is required' });
    return;
  }

  try {
    const challenge = await getChallengeBySlug(slug);

    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    res.json(challenge);
  } catch (err) {
    console.error('Error fetching challenge by slug:', err);
    res.status(500).json({ error: 'Failed to fetch challenge' });
  }
});

/* ------------------------------------------
 *  GET /api/challenges/:slug/seeds
 * ----------------------------------------*/
router.get('/:slug/seeds', async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    const seeds = await listChallengeSeedsBySlug(slug);
    res.json(seeds);
  } catch (err) {
    console.error('Error fetching seeds:', err);
    res.status(500).json({ error: 'Failed to fetch seeds' });
  }
});

/* ------------------------------------------
 *  POST /api/challenges/:slug/seeds  (ADMIN)
 * ----------------------------------------*/
router.post('/:slug/seeds', authRequired, requireAdmin, async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { seed_number, variant, seed_payload } = req.body;

  if (seed_number == null) {
    return res.status(400).json({ error: 'seed_number is required' });
  }

  try {
    const seed = await createChallengeSeedBySlug(slug, {
      seed_number,
      variant: variant ?? null,
      seed_payload: seed_payload ?? null,
    });

    res.status(201).json(seed);
  } catch (err) {
    if (err.code === 'CHALLENGE_SEED_EXISTS') {
      return res.status(409).json({
        error: 'Seed already exists for this challenge with that number',
      });
    }
    console.error('Error creating seed:', err);
    res.status(500).json({ error: 'Failed to create seed' });
  }
});

/* ------------------------------------------
 *  GET /api/challenges/:slug/teams
 * ----------------------------------------*/
router.get('/:slug/teams', async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    const teams = await listChallengeTeamsBySlug(slug);
    res.json(teams);
  } catch (err) {
    console.error('Error fetching teams:', err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

export default router;
