import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

/*
 * Auth routes — Ticket 027
 *
 * Login uses display_name + password (bcryptjs, 12 rounds).
 * Shadow accounts (password_hash IS NULL) cannot log in.
 * isOrganiser = role IN ('ADMIN', 'SUPERADMIN').
 */

interface LoginBody {
  display_name: string;
  password: string;
}

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login
  app.post('/api/auth/login', async (req, reply) => {
    const body = req.body as LoginBody;
    if (!body?.display_name || !body?.password) {
      return reply
        .status(400)
        .send({ ok: false, error: 'display_name and password are required', code: 'bad_request' });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.displayName, body.display_name))
      .limit(1);

    if (!user || !user.passwordHash) {
      return reply
        .status(401)
        .send({ ok: false, error: 'Invalid credentials', code: 'invalid_credentials' });
    }

    const isMatch = await bcrypt.compare(body.password, user.passwordHash);
    if (!isMatch) {
      return reply
        .status(401)
        .send({ ok: false, error: 'Invalid credentials', code: 'invalid_credentials' });
    }

    req.session.userId = user.id;

    return reply.status(200).send({
      ok: true,
      user: {
        id: user.id,
        display_name: user.displayName,
        isOrganiser: user.role === 'ADMIN' || user.role === 'SUPERADMIN',
      },
    });
  });

  // POST /api/auth/logout
  app.post('/api/auth/logout', async (req, reply) => {
    await req.session.destroy();
    return reply.status(200).send({ ok: true });
  });

  // GET /api/auth/me
  app.get('/api/auth/me', async (req, reply) => {
    const userId = req.session.userId;
    if (!userId) {
      return reply.status(401).send({ ok: false, error: 'Unauthorized', code: 'unauthorized' });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return reply.status(401).send({ ok: false, error: 'Unauthorized', code: 'unauthorized' });
    }

    return reply.status(200).send({
      user: {
        id: user.id,
        display_name: user.displayName,
        isOrganiser: user.role === 'ADMIN' || user.role === 'SUPERADMIN',
      },
    });
  });
}
