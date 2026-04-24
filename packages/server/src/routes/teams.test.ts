import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildServer } from '../index.js';

// Mock the db module
vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock the eventOrganisers query used by requireOrganiser
vi.mock('../middleware/auth.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../middleware/auth.js')>();
  return {
    ...orig,
    requireAuth: vi.fn(async (req: { headers: Record<string, string>; userId: number }, reply: { status: (n: number) => { send: (v: unknown) => void }; sent: boolean }) => {
      const id = req.headers['x-user-id'];
      if (!id) {
        reply.status(401).send({ ok: false, error: 'Unauthorized', code: 'unauthorized' });
        return;
      }
      req.userId = parseInt(id as string, 10);
    }),
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
  const chain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  };
  return chain;
}

function makeUpdateChain() {
  const chain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  return chain;
}

describe('Teams routes', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildServer();
    await app.ready();
  });

  it('POST /api/teams — creates team and adds creator as member', async () => {
    const mockDb = db as ReturnType<typeof vi.fn> & typeof db;

    const teamResult = [{ id: 1, name: 'Team Alpha', createdAt: new Date() }];
    const insertChain = makeInsertChain(teamResult);
    (mockDb.insert as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(insertChain) // teams insert
      .mockReturnValueOnce(makeInsertChain()); // teamMembers insert

    const res = await app.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'x-user-id': '42', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Team Alpha' }),
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { team: { id: number; name: string } };
    expect(body.team.id).toBe(1);
    expect(body.team.name).toBe('Team Alpha');
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it('POST /api/teams — 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/teams',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Team Alpha' }),
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/teams/:teamId/members — adds member when requester is current member', async () => {
    const mockDb = db as ReturnType<typeof vi.fn> & typeof db;

    // Requester IS a current member
    const selectChain = makeSelectChain([{ id: 1, teamId: 10, userId: 42 }]);
    (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectChain);
    (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeInsertChain());

    const res = await app.inject({
      method: 'POST',
      url: '/api/teams/10/members',
      headers: { 'x-user-id': '42', 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 99 }),
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ ok: true });
  });

  it('POST /api/teams/:teamId/members — 403 when requester is not a member', async () => {
    const mockDb = db as ReturnType<typeof vi.fn> & typeof db;

    // Requester is NOT a member
    const selectChain = makeSelectChain([]);
    (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(selectChain);

    const res = await app.inject({
      method: 'POST',
      url: '/api/teams/10/members',
      headers: { 'x-user-id': '42', 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 99 }),
    });

    expect(res.statusCode).toBe(403);
  });

  it('GET /api/teams/:teamId — returns team with members', async () => {
    const mockDb = db as ReturnType<typeof vi.fn> & typeof db;

    const teamChain = makeSelectChain([{ id: 10, name: 'Team Alpha' }]);
    const membersChain = makeSelectChain([
      { userId: 42, joinedAt: new Date(), leftAt: null },
    ]);
    (mockDb.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(teamChain)
      .mockReturnValueOnce(membersChain);

    const res = await app.inject({
      method: 'GET',
      url: '/api/teams/10',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { team: { id: number; name: string; members: unknown[] } };
    expect(body.team.id).toBe(10);
    expect(body.team.members).toHaveLength(1);
  });

  it('DELETE /api/teams/:teamId/members/:userId — sets leftAt (self-removal)', async () => {
    const mockDb = db as ReturnType<typeof vi.fn> & typeof db;

    (mockDb.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(makeUpdateChain());

    const res = await app.inject({
      method: 'DELETE',
      url: '/api/teams/10/members/42',
      headers: { 'x-user-id': '42' },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toMatchObject({ ok: true });
    expect(mockDb.update).toHaveBeenCalledOnce();
  });
});
