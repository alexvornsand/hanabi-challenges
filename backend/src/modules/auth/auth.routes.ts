// src/modules/auth/auth.routes.ts
import { Router, type Request, type Response } from 'express';
import { authRequired, AuthenticatedRequest } from '../../middleware/authMiddleware';
import { loginOrCreateUser, pickTextColor, randomHexColor } from './auth.service';
import { pool } from '../../config/db';

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

// GET /api/users/:display_name
router.get('/users/:display_name', async (req: Request, res: Response) => {
  const { display_name } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT id, display_name, role, color_hex, text_color, created_at
      FROM users
      WHERE display_name = $1;
      `,
      [display_name],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = result.rows[0];
    const color = row.color_hex ?? randomHexColor();
    const textColor = row.text_color ?? pickTextColor(color);

    // Backfill if missing
    if (!row.color_hex || !row.text_color) {
      await pool.query(
        `
        UPDATE users
        SET color_hex = $1, text_color = $2
        WHERE id = $3;
        `,
        [color, textColor, row.id],
      );
    }

    res.json({
      ...row,
      color_hex: color,
      text_color: textColor,
    });
  } catch (err) {
    console.error('Error fetching user by display_name:', err);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
