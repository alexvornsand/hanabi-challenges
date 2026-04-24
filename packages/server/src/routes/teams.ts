import type { FastifyInstance } from 'fastify';
import { notImplemented } from '../types.js';

export async function teamsRoutes(app: FastifyInstance) {
  // POST /api/teams — create team
  app.post('/api/teams', async (_req, reply) => notImplemented(reply));

  // POST /api/teams/:teamId/members — add member
  app.post('/api/teams/:teamId/members', async (_req, reply) => notImplemented(reply));

  // DELETE /api/teams/:teamId/members/:userId — remove member
  app.delete('/api/teams/:teamId/members/:userId', async (_req, reply) => notImplemented(reply));

  // GET /api/teams/:teamId — get team
  app.get('/api/teams/:teamId', async (_req, reply) => notImplemented(reply));
}
