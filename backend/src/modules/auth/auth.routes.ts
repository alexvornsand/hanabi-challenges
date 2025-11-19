// src/modules/auth/auth.routes.ts
import { Router, type Request, type Response } from 'express';
import { authRequired, AuthenticatedRequest } from '../../middleware/authMiddleware';
import { loginOrCreateUser } from './auth.service';

const router = Router();

// POST /api/login
router.post('/login', async (req: Request, res: Response) => {
  const { display_name, password } = req.body;

  if (!display_name || !password) {
    res.status(400).json({ error: 'display_name and password are required' });
    return;
  }

  try {
    const result = await loginOrCreateUser(display_name, password);

    // Service already knows whether it's "created" or "login"
    res.status(result.mode === 'created' ? 201 : 200).json(result);
  } catch (err) {
    if (err.code === 'INVALID_CREDENTIALS') {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    console.error('Error during login:', err);
    res.status(500).json({ error: 'Failed to log in' });
  }
});

// GET /api/me
router.get('/me', authRequired, (req: AuthenticatedRequest, res: Response) => {
  res.json({
    message: 'Token is valid',
    user: req.user,
  });
});

export default router;
