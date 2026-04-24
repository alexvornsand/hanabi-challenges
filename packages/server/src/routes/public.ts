import type { FastifyInstance } from 'fastify';
import { notImplemented } from '../types.js';

export async function publicRoutes(app: FastifyInstance) {
  // GET /api/events/:id/scoreboard — public scoreboard
  app.get('/api/events/:id/scoreboard', async (_req, reply) => notImplemented(reply));

  // GET /api/events/:id/slots — public slot list
  app.get('/api/events/:id/slots', async (_req, reply) => notImplemented(reply));

  // GET /api/events/:id/my-progress — participant's own progress
  app.get('/api/events/:id/my-progress', async (_req, reply) => notImplemented(reply));

  // GET /api/events/:id/awards — list of awards and winners
  app.get('/api/events/:id/awards', async (_req, reply) => notImplemented(reply));

  // GET /api/events/:id/sections — event section structure
  app.get('/api/events/:id/sections', async (_req, reply) => notImplemented(reply));

  // GET /api/events/:id/sections/:sectionId — section detail
  app.get('/api/events/:id/sections/:sectionId', async (_req, reply) => notImplemented(reply));
}
