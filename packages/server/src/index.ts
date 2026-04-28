import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import fastifyStatic from '@fastify/static';
import cron from 'node-cron';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const _require = createRequire(import.meta.url);
import { eventsRoutes } from './routes/events.js';
import { adminRoutes } from './routes/admin.js';
import { publicRoutes } from './routes/public.js';
import { authRoutes } from './routes/auth.js';
import { registrationsRoutes } from './routes/registrations.js';
import { teamsRoutes } from './routes/teams.js';
import { scrapeGames } from './jobs/scrapeGames.js';
import { syncVariantsFromHLive } from './jobs/syncVariants.js';
import { db } from './db/index.js';

export async function buildServer() {
  const fastify = Fastify({
    logger: config.NODE_ENV !== 'test',
  });

  // CORS
  await fastify.register(cors, {
    origin: config.CORS_ORIGIN,
    credentials: true,
  });

  // Cookies + session
  await fastify.register(cookie);
  await fastify.register(session, {
    secret: config.SESSION_SECRET,
    cookie: {
      secure: config.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
    },
  });

  // Reference docs (production: serve built Docusaurus output)
  if (config.NODE_ENV === 'production') {
    const referenceRoot = path.resolve(__dirname, '../../../reference/build');
    await fastify.register(fastifyStatic, {
      root: referenceRoot,
      prefix: '/reference/',
      decorateReply: false,
    });
  }

  // Health check
  fastify.get('/health', async () => ({ status: 'ok' }));

  // Routes
  await fastify.register(eventsRoutes);
  await fastify.register(adminRoutes);
  await fastify.register(publicRoutes);
  await fastify.register(authRoutes);
  await fastify.register(registrationsRoutes);
  await fastify.register(teamsRoutes);

  return fastify;
}

// Start server only when executed directly
const isMain = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isMain) {
  const server = await buildServer();
  try {
    await server.listen({ port: config.PORT, host: '0.0.0.0' });
    // Scrape games every 6 hours
    cron.schedule('0 */6 * * *', () => {
      scrapeGames(db).catch((err) => server.log.error(err, 'scrapeGames failed'));
    });
    // Sync variants from H-Live weekly Sunday 2am
    cron.schedule('0 2 * * 0', () => {
      syncVariantsFromHLive(db).catch((err) => server.log.error(err, 'syncVariantsFromHLive failed'));
    });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}
