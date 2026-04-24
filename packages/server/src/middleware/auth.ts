import type { FastifyRequest, FastifyReply } from 'fastify';
import type { DB } from '../db/index.js';

// V1 stub — replaced by real auth in ticket 028
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.headers['x-user-id'];
  if (!userId) {
    reply.status(401).send({ ok: false, error: 'Unauthorized', code: 'unauthorized' });
    return;
  }
  request.userId = parseInt(userId as string, 10);
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
