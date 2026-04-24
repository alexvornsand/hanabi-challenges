import type { FastifyInstance } from 'fastify';
import { notImplemented } from '../types.js';

export async function eventsRoutes(app: FastifyInstance) {
  // GET /api/events — list all published events
  app.get('/api/events', async (_req, reply) => notImplemented(reply));

  // GET /api/events/new — event template (blank config)
  app.get('/api/events/new', async (_req, reply) => notImplemented(reply));

  // GET /api/events/:id — get a single event
  app.get('/api/events/:id', async (_req, reply) => notImplemented(reply));

  // PUT /api/events/:id — save (update) event config
  app.put('/api/events/:id', async (_req, reply) => notImplemented(reply));

  // POST /api/events/:id/publish — publish event
  app.post('/api/events/:id/publish', async (_req, reply) => notImplemented(reply));

  // POST /api/events/:id/close — close event
  app.post('/api/events/:id/close', async (_req, reply) => notImplemented(reply));

  // GET /api/events/:id/manage — organiser management view
  app.get('/api/events/:id/manage', async (_req, reply) => notImplemented(reply));
}
