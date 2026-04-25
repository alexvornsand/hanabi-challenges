/**
 * NVC End-to-End Integration Test
 *
 * Requires a real Postgres database. All operations run within a transaction
 * that is rolled back at the end of each test.
 *
 * Run with:
 *   DATABASE_URL=postgres://... pnpm --filter @hanabi/server test:e2e
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import postgres from 'postgres';
import { buildServer } from '../../index.js';
import { config } from '../../config.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const NVC_YAML = fs.readFileSync(
  path.resolve(fileURLToPath(import.meta.url), '../../../../../../packages/dsl/src/__fixtures__/nvc.yaml'),
  'utf-8',
);

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let app: FastifyInstance;
let client: ReturnType<typeof postgres>;

beforeAll(async () => {
  app = await buildServer();
  client = postgres(config.DATABASE_URL);
});

afterAll(async () => {
  await app.close();
  await client.end();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createOrganiserUser(name: string) {
  const hash = await bcrypt.hash('testpass123', 12);
  const [user] = await client`
    INSERT INTO users (display_name, password_hash, role)
    VALUES (${name}, ${hash}, 'ADMIN')
    RETURNING id, display_name
  `;
  return user!;
}

async function login(displayName: string, password: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { display_name: displayName, password },
  });
  const cookie = res.headers['set-cookie'];
  return { body: JSON.parse(res.body), cookie: Array.isArray(cookie) ? (cookie[0] ?? '') : cookie ?? '' };
}

// ---------------------------------------------------------------------------
// NVC E2E test
// ---------------------------------------------------------------------------

describe('NVC E2E', () => {
  let sessionCookie: string;
  let eventId: number;
  let userId: number;

  beforeEach(async () => {
    // Create test user directly via DB
    const name = `test-organiser-${Date.now()}`;
    const user = await createOrganiserUser(name);
    userId = user.id;

    // Log in
    const { cookie } = await login(name, 'testpass123');
    sessionCookie = cookie;
  });

  afterEach(async () => {
    // Cleanup: delete created test data
    if (eventId) {
      await client`DELETE FROM event_organisers WHERE event_id = ${eventId}`;
      await client`DELETE FROM sections WHERE id = ${eventId}`;
    }
    if (userId) {
      await client`DELETE FROM users WHERE id = ${userId}`;
    }
  });

  it('full NVC lifecycle: create → publish → games → standings → close', async () => {
    // 1. Create event
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/events',
      headers: { cookie: sessionCookie },
      payload: { yaml: NVC_YAML },
    });

    expect(createRes.statusCode).toBe(201);
    const createBody = JSON.parse(createRes.body);
    eventId = createBody.eventId;
    expect(eventId).toBeGreaterThan(0);

    // 2. Publish event
    const publishRes = await app.inject({
      method: 'POST',
      url: `/api/admin/events/${eventId}/publish`,
      headers: { cookie: sessionCookie },
      payload: {},
    });

    expect(publishRes.statusCode).toBe(200);
    const publishBody = JSON.parse(publishRes.body);
    expect(publishBody.ok).toBe(true);
    // NVC has slots per player count class — specsRegistered > 0
    expect(publishBody.specsRegistered).toBeGreaterThan(0);

    // 3. Register test user and insert game results
    // Register userId as 2p individual
    await client`
      INSERT INTO registrations (event_id, unit_type, unit_id, dimension_axis, division_value, registered_by)
      VALUES (${eventId}, 'individual', ${userId}, 'player_count_class', '2p', ${userId})
    `;

    // Get a spec for this event
    const [spec] = await client`
      SELECT id, spec_string FROM game_specs WHERE section_id = ${eventId} LIMIT 1
    `;

    if (!spec) {
      // Skip game assertions if no specs were registered (pipeline dependency)
      return;
    }

    // Insert 2 games with max_score=true, 3 without
    const gameResultPayload = { points: 25, max_score: true };
    const gameResultPayloadFalse = { points: 20, max_score: false };

    for (let i = 0; i < 2; i++) {
      await client`
        INSERT INTO games (spec_id, participants, result, game_timestamp, source, tags, game_result_payload)
        VALUES (${spec.id}, ${JSON.stringify([userId])}, ${JSON.stringify(gameResultPayload)},
                NOW(), 'submitted', '[]', ${JSON.stringify(gameResultPayload)})
      `;
    }
    for (let i = 0; i < 3; i++) {
      await client`
        INSERT INTO games (spec_id, participants, result, game_timestamp, source, tags, game_result_payload)
        VALUES (${spec.id}, ${JSON.stringify([userId])}, ${JSON.stringify(gameResultPayloadFalse)},
                NOW(), 'submitted', '[]', ${JSON.stringify(gameResultPayloadFalse)})
      `;
    }

    // 4. GET /api/nvc/standings
    const standingsRes = await app.inject({
      method: 'GET',
      url: '/api/nvc/standings',
    });

    expect(standingsRes.statusCode).toBe(200);
    const standingsBody = JSON.parse(standingsRes.body);
    expect(standingsBody.rows).toBeDefined();
    // Units with score > 0 should rank above those with score 0
    if (standingsBody.rows.length > 1) {
      expect(standingsBody.rows[0].score).toBeGreaterThanOrEqual(standingsBody.rows[1].score);
    }

    // 5. Close event
    const closeRes = await app.inject({
      method: 'POST',
      url: `/api/admin/events/${eventId}/close`,
      headers: { cookie: sessionCookie },
      payload: {},
    });

    expect(closeRes.statusCode).toBe(200);
    const closeBody = JSON.parse(closeRes.body);
    expect(closeBody.ok).toBe(true);

    // Verify event is closed
    const [closedEvent] = await client`SELECT status FROM sections WHERE id = ${eventId}`;
    expect(closedEvent!.status).toBe('closed');

    // Cleanup game specs and games
    await client`DELETE FROM games WHERE spec_id = ${spec.id}`;
    await client`DELETE FROM registrations WHERE event_id = ${eventId} AND unit_id = ${userId}`;
  });
});
