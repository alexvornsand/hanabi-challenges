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
        req.userId = parseInt(id as string, 10);
      },
    ),
  };
});

import { db } from '../db/index.js';

function makeSelectChain(result: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  };
  return chain;
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

const EXPLICIT_EVENT = {
  id: 1,
  slug: 'test-event',
  status: 'published',
  config: {
    registration: { policy: { explicit: true, cardinality: 'one_per_unit' } },
    dimensions: [{ axis: 'skill', values: ['beginner', 'advanced'] }],
  },
};

const IMPLICIT_EVENT = {
  id: 2,
  slug: 'implicit-event',
  status: 'published',
  config: {
    registration: { policy: { explicit: false, implicit: true } },
    dimensions: [],
  },
};

describe('Registrations routes', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildServer();
    await app.ready();
  });

  it('POST /api/events/:slug/register — registers individual successfully', async () => {
    const mockDb = db as ReturnType<typeof vi.fn> & typeof db;

    // Event query + cardinality check (no existing registration)
    (mockDb.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([EXPLICIT_EVENT]))
      .mockReturnValueOnce(makeSelectChain([]));

    const regResult = [
      {
        id: 100,
        eventId: 1,
        unitType: 'individual',
        unitId: 42,
        dimensionAxis: 'skill',
        divisionValue: 'beginner',
        registeredAt: new Date(),
        registeredBy: 42,
      },
    ];
    (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeInsertChain(regResult));

    const res = await app.inject({
      method: 'POST',
      url: '/api/events/test-event/register',
      headers: { 'x-user-id': '42', 'content-type': 'application/json' },
      body: JSON.stringify({
        unitType: 'individual',
        unitId: 42,
        dimensionAxis: 'skill',
        divisionValue: 'beginner',
      }),
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { registration: { id: number } };
    expect(body.registration.id).toBe(100);
  });

  it('POST /api/events/:slug/register — 400 for implicit-only event', async () => {
    const mockDb = db as ReturnType<typeof vi.fn> & typeof db;
    (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeSelectChain([IMPLICIT_EVENT]),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/events/implicit-event/register',
      headers: { 'x-user-id': '42', 'content-type': 'application/json' },
      body: JSON.stringify({ unitType: 'individual', unitId: 42, dimensionAxis: 'skill', divisionValue: 'beginner' }),
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { code: string };
    expect(body.code).toBe('implicit_only');
  });

  it('POST /api/events/:slug/register — 403 when registering as team non-member', async () => {
    const mockDb = db as ReturnType<typeof vi.fn> & typeof db;

    // Event query; team membership check: not a member
    (mockDb.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([EXPLICIT_EVENT]))
      .mockReturnValueOnce(makeSelectChain([]));

    const res = await app.inject({
      method: 'POST',
      url: '/api/events/test-event/register',
      headers: { 'x-user-id': '42', 'content-type': 'application/json' },
      body: JSON.stringify({
        unitType: 'team',
        unitId: 10,
        dimensionAxis: 'skill',
        divisionValue: 'beginner',
      }),
    });

    expect(res.statusCode).toBe(403);
  });

  it('GET /api/events/:slug/registrations — returns registrations list', async () => {
    const mockDb = db as ReturnType<typeof vi.fn> & typeof db;

    // Event query; no x-user-id so organiser check is skipped; registrations query
    (mockDb.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(makeSelectChain([EXPLICIT_EVENT]))
      .mockReturnValueOnce(
        makeSelectChain([
          {
            unitType: 'individual',
            unitId: 42,
            dimensionAxis: 'skill',
            divisionValue: 'beginner',
            registeredAt: new Date(),
          },
        ]),
      );

    const res = await app.inject({
      method: 'GET',
      url: '/api/events/test-event/registrations',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { registrations: unknown[] };
    expect(body.registrations).toHaveLength(1);
  });

  it('DELETE /api/events/:slug/register — removes registration (individual self-unregister)', async () => {
    const mockDb = db as ReturnType<typeof vi.fn> & typeof db;

    (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      makeSelectChain([EXPLICIT_EVENT]),
    );
    (mockDb.delete as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeDeleteChain());

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/events/test-event/register',
      headers: { 'x-user-id': '42', 'content-type': 'application/json' },
      body: JSON.stringify({ unitType: 'individual', unitId: 42, dimensionAxis: 'skill' }),
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ ok: true });
  });
});
