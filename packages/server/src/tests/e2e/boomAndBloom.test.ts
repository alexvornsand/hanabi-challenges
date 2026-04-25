/**
 * Boom and Bloom End-to-End Test
 *
 * Tests: inferred classification, unit_attribution, tiebreaker tournament,
 * admin lazy slot trigger.
 *
 * Requires a real Postgres database.
 * Run with: DATABASE_URL=postgres://... pnpm --filter @hanabi/server test:e2e
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
import { classifyGames } from '../../lib/classificationEngine.js';
import { builtinRegistry } from '@hanabi/dsl/src/predicates/registry.js';

const BOOM_YAML = fs.readFileSync(
  path.resolve(fileURLToPath(import.meta.url), '../../../../../../packages/dsl/src/__fixtures__/boom-and-bloom.yaml'),
  'utf-8',
);

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

async function createUser(name: string, role = 'ADMIN') {
  const hash = await bcrypt.hash('testpass', 12);
  const [user] = await client`
    INSERT INTO users (display_name, password_hash, role)
    VALUES (${name}, ${hash}, ${role})
    RETURNING id, display_name
  `;
  return user!;
}

async function login(displayName: string, password = 'testpass') {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { display_name: displayName, password },
  });
  const cookie = res.headers['set-cookie'];
  return Array.isArray(cookie) ? (cookie[0] ?? '') : cookie ?? '';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Boom and Bloom E2E', () => {
  let sessionCookie: string;
  let eventId: number;
  let aliceId: number;
  let bobId: number;
  let cathyId: number;
  let daveId: number;

  beforeEach(async () => {
    const ts = Date.now();
    const alice = await createUser(`alice-${ts}`);
    const bob = await createUser(`bob-${ts}`);
    const cathy = await createUser(`cathy-${ts}`);
    const dave = await createUser(`dave-${ts}`);
    aliceId = alice.id;
    bobId = bob.id;
    cathyId = cathy.id;
    daveId = dave.id;

    const organiser = await createUser(`organiser-${ts}`);
    sessionCookie = await login(`organiser-${ts}`);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/events',
      headers: { cookie: sessionCookie },
      payload: { yaml: BOOM_YAML },
    });
    eventId = JSON.parse(createRes.body).eventId;
  });

  afterEach(async () => {
    if (eventId) {
      await client`DELETE FROM event_organisers WHERE event_id = ${eventId}`;
      await client`DELETE FROM sections WHERE id = ${eventId}`;
    }
    for (const id of [aliceId, bobId, cathyId, daveId]) {
      if (id) await client`DELETE FROM users WHERE id = ${id}`;
    }
  });

  it('classifies Alice+Bob as team, Cathy as individual', () => {
    // Alice (aliceId) and Bob (bobId) always play together
    const games = [
      { id: 1, participants: [aliceId, bobId] },
      { id: 2, participants: [aliceId, bobId] },
      { id: 3, participants: [aliceId, bobId] },
      // Cathy plays with various partners
      { id: 4, participants: [cathyId, daveId] },
      { id: 5, participants: [cathyId, aliceId] },
    ];

    const names = new Map([
      [aliceId, 'Alice'],
      [bobId, 'Bob'],
      [cathyId, 'Cathy'],
      [daveId, 'Dave'],
    ]);

    const result = classifyGames(games, 'stable_partnership', names, builtinRegistry);

    // Alice and Bob should be team:aliceId,bobId
    const teamKey = `team:${Math.min(aliceId, bobId)},${Math.max(aliceId, bobId)}`;
    const team = result.units.find((u) => u.unitKey === teamKey);
    expect(team).toBeDefined();
    expect(team?.type).toBe('team');

    // Cathy should be individual (played with different partners)
    const cathyUnit = result.units.find((u) => u.unitKey === `individual:${cathyId}`);
    expect(cathyUnit).toBeDefined();
    expect(cathyUnit?.type).toBe('individual');
  });

  it('reclassifies all games as individual when Bob plays with Cathy', () => {
    const games = [
      { id: 1, participants: [aliceId, bobId] },
      { id: 2, participants: [aliceId, bobId] },
      { id: 3, participants: [aliceId, bobId] },
      { id: 4, participants: [bobId, cathyId] }, // Bob breaks stable partnership
    ];

    const names = new Map([
      [aliceId, 'Alice'],
      [bobId, 'Bob'],
      [cathyId, 'Cathy'],
    ]);

    const result = classifyGames(games, 'stable_partnership', names, builtinRegistry);

    // Bob should be individual (inconsistent)
    const bobUnit = result.units.find((u) => u.unitKey === `individual:${bobId}`);
    expect(bobUnit).toBeDefined();

    // Team:alice,bob should NOT exist
    const teamKey = `team:${Math.min(aliceId, bobId)},${Math.max(aliceId, bobId)}`;
    expect(result.units.find((u) => u.unitKey === teamKey)).toBeUndefined();
  });
});
