import type { FastifyInstance } from 'fastify';
import { notImplemented } from '../types.js';

export async function adminRoutes(app: FastifyInstance) {
  // GET /api/admin/variants — list all registered variants
  app.get('/api/admin/variants', async (_req, reply) => notImplemented(reply));
}
