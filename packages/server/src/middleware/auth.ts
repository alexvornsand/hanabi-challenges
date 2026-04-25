import type { FastifyRequest, FastifyReply } from 'fastify';
import type { DB } from '../db/index.js';

/*
 * Auth layer — Ticket 027
 *
 * Replaced stub x-user-id header with real session-based auth.
 *
 * Schema (apps/api/db/schema.sql):
 *   users.id           SERIAL PRIMARY KEY
 *   users.display_name CITEXT NOT NULL UNIQUE  (used as login name)
 *   users.password_hash TEXT  (null for shadow accounts — cannot log in)
 *   users.role         TEXT CHECK ('SUPERADMIN'|'ADMIN'|'USER')
 *
 * Session stores: { userId: number }
 * Platform organiser = role IN ('ADMIN', 'SUPERADMIN')
 */

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.session.userId;
  if (!userId) {
    reply.status(401).send({ ok: false, error: 'Unauthorized', code: 'unauthorized' });
    return;
  }
  request.userId = userId;
}

export async function requireOrganiser(
  request: FastifyRequest,
  reply: FastifyReply,
  eventId: number,
  db: DB,
) {
  await requireAuth(request, reply);
  if (reply.sent) return;
  const row = await db.query.eventOrganisers.findFirst({
    where: (t, { and, eq }) => and(eq(t.eventId, eventId), eq(t.userId, request.userId)),
  });
  if (!row) {
    reply.status(403).send({ ok: false, error: 'Forbidden', code: 'forbidden' });
    return;
  }
}

export async function requirePlatformOrganiser(
  request: FastifyRequest,
  reply: FastifyReply,
  db: DB,
) {
  await requireAuth(request, reply);
  if (reply.sent) return;
  const user = await db.query.users.findFirst({
    where: (t, { eq }) => eq(t.id, request.userId),
  });
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
    reply.status(403).send({ ok: false, error: 'Forbidden', code: 'forbidden' });
    return;
  }
}
