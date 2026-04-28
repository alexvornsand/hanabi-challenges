import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildServer } from '../index.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../middleware/auth.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../middleware/auth.js')>();
  return {
    ...orig,
    requireAuth: vi.fn(
      async (
        req: { headers: Record<string, string>; userId: number },
        reply: { status: (n: number) => { send: (v: unknown) => void }; sent: boolean },
      ) => {
        const id = req.headers['x-user-id'];
        if (!id) {
          reply.status(401).send({ ok: false, error: 'Unauthorized', code: 'unauthorized' });
          return;
        }
        req.userId = parseInt(id, 10);
      },
    ),
  };
});

// Use real DSL pipeline (evalExpr, parseExpr) — pure functions, no mocking needed
// Only mock db and auth

import { db } from '../db/index.js';

type MockDb = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function makeSelectChain(result: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
}

function makeInsertChain(result: unknown[] = []) {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  };
}

function makeDeleteChain() {
  return {
    where: vi.fn().mockResolvedValue(undefined),
  };
}

function makeSelectChainNoLimit(result: unknown[]) {
  // For chains that call where() without a following limit()
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(result),
    limit: vi.fn().mockResolvedValue(result),
  };
}

const VALID_BODY = {
  spec_string: 'e1g0',
  points: 25,
  max_score: true,
  datetime_start: '2026-06-01T10:00:00Z',
  datetime_end: '2026-06-01T10:30:00Z',
  participants: [42, 43],
};

const PUBLISHED_SECTION = {
  id: 10,
  slug: 'nvc',
  name: 'NVC',
  status: 'published',
  captureMode: 'both',
  start: null,
  config: {
    capture_policy: { submit: true, scrape: true },
    registration_policy: { implicit: true },
  },
};

const SPEC_ROW = {
  id: 1,
  specString: 'e1g0',
  sectionId: 10,
  slotId: null,
  slotIndex: 0,
};

describe('Game submission route', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    app = await buildServer();
    await app.ready();
  });

  it('POST /api/:slug/games — valid submission → 201', async () => {
    const mockDb = db as unknown as MockDb;

    mockDb.select
      .mockReturnValueOnce(makeSelectChain([SPEC_ROW]))       // game_specs lookup
      .mockReturnValueOnce(makeSelectChain([PUBLISHED_SECTION])) // sections
      .mockReturnValueOnce(makeSelectChain([]))                // duplicate check
      .mockReturnValueOnce(makeSelectChain([]));               // sections for implicit register

    mockDb.insert
      .mockReturnValueOnce(makeInsertChain([{ id: 100 }]))     // games insert
      .mockReturnValueOnce(makeInsertChain());                  // registrations (implicitlyRegister)
    mockDb.delete.mockReturnValueOnce(makeDeleteChain());       // speculative_pr_results

    const res = await app.inject({
      method: 'POST',
      url: '/api/nvc/games',
      headers: { 'x-user-id': '42', 'content-type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { ok: boolean; gameId: number };
    expect(body.ok).toBe(true);
    expect(body.gameId).toBe(100);
  });

  it('POST /api/:slug/games — submit: false → 400', async () => {
    const mockDb = db as unknown as MockDb;

    const submitFalseSection = {
      ...PUBLISHED_SECTION,
      config: {
        capture_policy: { submit: false, scrape: true },
        registration_policy: { implicit: true },
      },
    };

    mockDb.select
      .mockReturnValueOnce(makeSelectChain([SPEC_ROW]))
      .mockReturnValueOnce(makeSelectChain([submitFalseSection]));

    const res = await app.inject({
      method: 'POST',
      url: '/api/nvc/games',
      headers: { 'x-user-id': '42', 'content-type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { code: string };
    expect(body.code).toBe('submit_disabled');
  });

  it('POST /api/:slug/games — outside time window → 400', async () => {
    const mockDb = db as unknown as MockDb;

    const futureSection = {
      ...PUBLISHED_SECTION,
      start: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // starts 1 week from now
    };

    mockDb.select
      .mockReturnValueOnce(makeSelectChain([SPEC_ROW]))
      .mockReturnValueOnce(makeSelectChain([futureSection]));

    const res = await app.inject({
      method: 'POST',
      url: '/api/nvc/games',
      headers: { 'x-user-id': '42', 'content-type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { code: string };
    expect(body.code).toBe('outside_time_window');
  });

  it('POST /api/:slug/games — failed validity rule → 400 with violations', async () => {
    const mockDb = db as unknown as MockDb;

    const specWithSlot = { ...SPEC_ROW, slotId: 5 };
    const slotRow = {
      id: 5,
      sectionId: 10,
      slotIndex: 0,
      assignmentTrigger: 'eager',
      lazyTrigger: null,
      status: 'issued',
      config: {
        seed_pattern: 'e1g0',
        validity_rules: [{ predicate: 'game.points >= 20' }],
      },
    };

    mockDb.select
      .mockReturnValueOnce(makeSelectChain([specWithSlot]))     // game_specs
      .mockReturnValueOnce(makeSelectChain([PUBLISHED_SECTION])) // sections
      .mockReturnValueOnce(makeSelectChain([slotRow]));          // slots for validity check

    const lowScoreBody = { ...VALID_BODY, points: 5, max_score: false };

    const res = await app.inject({
      method: 'POST',
      url: '/api/nvc/games',
      headers: { 'x-user-id': '42', 'content-type': 'application/json' },
      body: JSON.stringify(lowScoreBody),
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { code: string; violations: string[] };
    expect(body.code).toBe('validity_violation');
    expect(body.violations).toContain('game.points >= 20');
  });

  it('POST /api/:slug/games — duplicate submission → 409', async () => {
    const mockDb = db as unknown as MockDb;

    mockDb.select
      .mockReturnValueOnce(makeSelectChain([SPEC_ROW]))
      .mockReturnValueOnce(makeSelectChain([PUBLISHED_SECTION]))
      .mockReturnValueOnce(makeSelectChain([{ id: 99 }])); // existing game found

    const res = await app.inject({
      method: 'POST',
      url: '/api/nvc/games',
      headers: { 'x-user-id': '42', 'content-type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body) as { code: string };
    expect(body.code).toBe('duplicate');
  });
});
