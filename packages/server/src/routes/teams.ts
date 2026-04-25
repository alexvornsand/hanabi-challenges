import type { FastifyInstance } from 'fastify';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { teams, teamMembers } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';

export async function teamsRoutes(app: FastifyInstance) {
  // POST /api/teams — create team
  app.post('/api/teams', async (req, reply) => {
    await requireAuth(req, reply);
    if (reply.sent) return;

    const body = req.body as { name?: string };
    if (!body?.name?.trim()) {
      return reply.status(400).send({ ok: false, error: 'name is required', code: 'bad_request' });
    }

    const [team] = await db
      .insert(teams)
      .values({ name: body.name.trim() })
      .returning({ id: teams.id, name: teams.name, createdAt: teams.createdAt });

    await db.insert(teamMembers).values({ teamId: team!.id, userId: req.userId });

    return reply.status(201).send({ team });
  });

  // POST /api/teams/:teamId/members — add member
  app.post('/api/teams/:teamId/members', async (req, reply) => {
    await requireAuth(req, reply);
    if (reply.sent) return;

    const teamId = parseInt((req.params as { teamId: string }).teamId, 10);
    if (isNaN(teamId)) {
      return reply.status(400).send({ ok: false, error: 'invalid teamId', code: 'bad_request' });
    }

    const body = req.body as { userId?: number };
    if (!body?.userId) {
      return reply.status(400).send({ ok: false, error: 'userId is required', code: 'bad_request' });
    }

    // Requester must be a current member
    const requesterMembership = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, req.userId),
          isNull(teamMembers.leftAt),
        ),
      )
      .limit(1);

    if (requesterMembership.length === 0) {
      return reply.status(403).send({ ok: false, error: 'Forbidden', code: 'forbidden' });
    }

    await db.insert(teamMembers).values({ teamId, userId: body.userId }).onConflictDoNothing();

    return reply.send({ ok: true });
  });

  // DELETE /api/teams/:teamId/members/:userId — remove member (sets leftAt)
  app.delete('/api/teams/:teamId/members/:userId', async (req, reply) => {
    await requireAuth(req, reply);
    if (reply.sent) return;

    const params = req.params as { teamId: string; userId: string };
    const teamId = parseInt(params.teamId, 10);
    const targetUserId = parseInt(params.userId, 10);

    if (isNaN(teamId) || isNaN(targetUserId)) {
      return reply.status(400).send({ ok: false, error: 'invalid params', code: 'bad_request' });
    }

    // Requester must be the target user or a current team member
    if (req.userId !== targetUserId) {
      const membership = await db
        .select()
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.userId, req.userId),
            isNull(teamMembers.leftAt),
          ),
        )
        .limit(1);
      if (membership.length === 0) {
        return reply.status(403).send({ ok: false, error: 'Forbidden', code: 'forbidden' });
      }
    }

    await db
      .update(teamMembers)
      .set({ leftAt: new Date() })
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, targetUserId),
          isNull(teamMembers.leftAt),
        ),
      );

    return reply.send({ ok: true });
  });

  // GET /api/teams/:teamId — get team with members
  app.get('/api/teams/:teamId', async (req, reply) => {
    const teamId = parseInt((req.params as { teamId: string }).teamId, 10);
    if (isNaN(teamId)) {
      return reply.status(400).send({ ok: false, error: 'invalid teamId', code: 'bad_request' });
    }

    const teamRows = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    if (teamRows.length === 0) {
      return reply.status(404).send({ ok: false, error: 'Not found', code: 'not_found' });
    }

    const members = await db
      .select({ userId: teamMembers.userId, joinedAt: teamMembers.joinedAt, leftAt: teamMembers.leftAt })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId))
      .limit(1000);

    return reply.send({
      team: {
        id: teamRows[0]!.id,
        name: teamRows[0]!.name,
        members,
      },
    });
  });
}
