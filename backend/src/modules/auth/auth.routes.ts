// src/modules/auth/auth.routes.ts
import { Router, type Request, type Response } from 'express';
import {
  authRequired,
  AuthenticatedRequest,
  requireSuperadmin,
} from '../../middleware/authMiddleware';
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

// GET /api/users/:display_name/events
router.get('/users/:display_name/events', async (req: Request, res: Response) => {
  const { display_name } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
        et.id AS event_team_id,
        et.name AS team_name,
        et.team_size,
        et.event_id,
        e.name AS event_name,
        e.slug AS event_slug,
        e.starts_at,
        e.ends_at
      FROM event_teams et
      JOIN team_memberships tm ON tm.event_team_id = et.id
      JOIN users u ON u.id = tm.user_id
      JOIN events e ON e.id = et.event_id
      WHERE u.display_name = $1
      ORDER BY e.starts_at NULLS LAST, et.id;
      `,
      [display_name],
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching user events:', err);
    res.status(500).json({ error: 'Failed to fetch user events' });
  }
});

// GET /api/users (for autocomplete / admin)
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `
      SELECT id, display_name, color_hex, text_color, role
      FROM users
      ORDER BY display_name;
      `,
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

async function updateUserRole(req: AuthenticatedRequest, res: Response) {
  const userId = Number(req.params.id);
  const { role } = req.body as { role?: string };
  const actor = req.user;

  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  if (role !== 'ADMIN' && role !== 'USER') {
    return res.status(400).json({ error: 'role must be ADMIN or USER' });
  }
  if (actor && actor.userId === userId) {
    return res.status(400).json({ error: 'You cannot change your own role' });
  }

  try {
    const targetResult = await pool.query(
      `
      SELECT id, role
      FROM users
      WHERE id = $1;
      `,
      [userId],
    );

    if (targetResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const target = targetResult.rows[0] as { id: number; role: string };

    // Do not modify SUPERADMINs via this endpoint
    if (target.role === 'SUPERADMIN') {
      return res.status(400).json({ error: 'Cannot change a SUPERADMIN role here' });
    }

    await pool.query(
      `
      UPDATE users
      SET role = $1
      WHERE id = $2;
      `,
      [role, userId],
    );

    res.json({ id: userId, role });
  } catch (err) {
    console.error('Error updating role:', err);
    res.status(500).json({ error: 'Failed to update role' });
  }
}

// PATCH /api/users/:id/role (SUPERADMIN only)
router.patch('/users/:id/role', authRequired, requireSuperadmin, updateUserRole);
// POST alias for convenience
router.post('/users/:id/role', authRequired, requireSuperadmin, updateUserRole);

export default router;
