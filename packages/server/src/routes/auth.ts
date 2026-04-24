import type { FastifyInstance } from 'fastify';
import { notImplemented } from '../types.js';

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login
  app.post('/api/auth/login', async (_req, reply) => notImplemented(reply));

  // POST /api/auth/logout
  app.post('/api/auth/logout', async (_req, reply) => notImplemented(reply));

  // GET /api/auth/me — current user info
  app.get('/api/auth/me', async (_req, reply) => notImplemented(reply));
}
