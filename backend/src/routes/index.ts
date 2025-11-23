import { Router } from 'express';
import authRouter from '../modules/auth/auth.routes';
import eventRouter from '../modules/events/event.routes';
import teamRouter from '../modules/teams/team.routes';
import resultRouter from '../modules/results/result.routes';

const router = Router();

router.use('/api', authRouter); // /api/login, /api/me
router.use('/api/events', eventRouter); // /api/events/...
router.use('/api/event-teams', teamRouter); // /api/event-teams/...
router.use('/api/results', resultRouter);

export default router;
