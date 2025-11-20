// src/modules/challenges/challenge.routes.ts
import { Router, Request, Response } from 'express';
import { authRequired, requireAdmin } from '../../middleware/authMiddleware';
import {
  listChallenges,
  createChallenge,
  listChallengeSeeds,
  createChallengeSeed,
  listChallengeTeams,
  getChallengeBySlug,
} from './challenge.service';


const router = Router();

// GET /api/challenges
router.get('/', async (_req: Request, res: Response) => {
  try {
    const challenges = await listChallenges();
    res.json(challenges);
  } catch (err) {
    console.error('Error fetching challenges:', err);
    res.status(500).json({ error: 'Failed to fetch challenges' });
  }
});

// POST /api/challenges (ADMIN or SUPERADMIN)
router.post('/', authRequired, requireAdmin, async (req: Request, res: Response) => {
  const { name, slug, short_description, long_description, starts_at, ends_at } = req.body;

  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }

  if (!slug) {
    res.status(400).json({ error: 'slug is required' });
    return;
  }

  if (!long_description) {
    res.status(400).json({ error: 'long_description is required' });
    return;
  }

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
    if ((err as { code?: string }).code === 'CHALLENGE_NAME_EXISTS') {
      res.status(409).json({ error: 'Challenge name must be unique' });
      return;
    }

    console.error('Error creating challenge:', err);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

// GET /api/challenges/:id/seeds
router.get('/:id/seeds', async (req: Request, res: Response) => {
  const challengeId = Number(req.params.id);

  if (Number.isNaN(challengeId)) {
    res.status(400).json({ error: 'Invalid challenge id' });
    return;
  }

  try {
    const seeds = await listChallengeSeeds(challengeId);
    res.json(seeds);
  } catch (err) {
    console.error('Error fetching challenge seeds:', err);
    res.status(500).json({ error: 'Failed to fetch seeds for challenge' });
  }
});

// POST /api/challenges/:id/seeds (ADMIN or SUPERADMIN)
router.post('/:id/seeds', authRequired, requireAdmin, async (req: Request, res: Response) => {
  const challengeId = Number(req.params.id);
  const { seed_number, variant, seed_payload } = req.body;

  if (Number.isNaN(challengeId)) {
    res.status(400).json({ error: 'Invalid challenge id' });
    return;
  }

  if (seed_number == null) {
    res.status(400).json({ error: 'seed_number is required' });
    return;
  }

  try {
    const seed = await createChallengeSeed(challengeId, {
      seed_number,
      variant: variant ?? null,
      seed_payload: seed_payload ?? null,
    });

    res.status(201).json(seed);
  } catch (err) {
    if ((err as { code?: string }).code === 'CHALLENGE_SEED_EXISTS') {
      res.status(409).json({
        error: 'Seed already exists for this challenge with that number',
      });
      return;
    }

    console.error('Error creating challenge seed:', err);
    res.status(500).json({ error: 'Failed to create challenge seed' });
  }
});

// GET /api/challenges/:id/teams
router.get('/:id/teams', async (req: Request, res: Response) => {
  const challengeId = Number(req.params.id);

  if (Number.isNaN(challengeId)) {
    res.status(400).json({ error: 'Invalid challenge id' });
    return;
  }

  try {
    const teams = await listChallengeTeams(challengeId);
    res.json(teams);
  } catch (err) {
    console.error('Error fetching teams:', err);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// GET /api/challenges/slug/:slug
router.get('/slug/:slug', async (req: Request, res: Response) => {
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

export default router;
