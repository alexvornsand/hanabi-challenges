import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { variantRegistry } from '../db/schema.js';

export async function adminRoutes(app: FastifyInstance) {
  // GET /api/admin/variants — list all registered variants
  app.get('/api/admin/variants', async (_req, reply) => {
    const variants = await db.select().from(variantRegistry).orderBy(variantRegistry.variantId);
    return reply.send({ variants });
  });
}
