import type { FastifyInstance } from 'fastify';
import { notImplemented } from '../types.js';

export async function registrationsRoutes(app: FastifyInstance) {
  // POST /api/events/:id/register
  app.post('/api/events/:id/register', async (_req, reply) => notImplemented(reply));

  // DELETE /api/events/:id/register — unregister
  app.delete('/api/events/:id/register', async (_req, reply) => notImplemented(reply));

  // GET /api/events/:id/registrations — list all registrations
  app.get('/api/events/:id/registrations', async (_req, reply) => notImplemented(reply));
}
