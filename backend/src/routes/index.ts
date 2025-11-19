import { Router } from 'express';
import authRouter from '../modules/auth/auth.routes';
import challengeRouter from '../modules/challenges/challenge.routes';
import teamRouter from '../modules/teams/team.routes';
import resultRouter from '../modules/results/result.routes';

const router = Router();

router.use('/api', authRouter); // /api/login, /api/me
router.use('/api/challenges', challengeRouter); // /api/challenges/...
router.use('/api/teams', teamRouter); // /api/teams/...
router.use('/api/results', resultRouter);

export default router;
