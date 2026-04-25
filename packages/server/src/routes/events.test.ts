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

// Mock auth middleware
vi.mock('../middleware/auth.js', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../middleware/auth.js')>();
  return {
    ...orig,
    requireAuth: vi.fn(),
    requireOrganiser: vi.fn(),
  };
});

// Mock the DSL pipeline
vi.mock('@hanabi/dsl/src/pipeline.js', () => ({
  runPipeline: vi.fn(),
}));

import { db } from '../db/index.js';
import { requireAuth, requireOrganiser } from '../middleware/auth.js';
import { runPipeline } from '@hanabi/dsl/src/pipeline.js';

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

function makeInsertChain() {
  return {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
  };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
}

function makeUpdateWithReturningChain(result: unknown[]) {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(result),
  };
}

function mockPassOrganiser() {
  (requireOrganiser as ReturnType<typeof vi.fn>).mockImplementation(
    async (req: { headers: Record<string, string>; userId: number }, reply: { status: (n: number) => { send: (v: unknown) => void }; sent: boolean }) => {
      const id = req.headers['x-user-id'];
      if (!id) {
        reply.status(401).send({ ok: false, error: 'Unauthorized', code: 'unauthorized' });
        return;
      }
      req.userId = parseInt(id, 10);
    },
  );
}

function mockPassAuth() {
  (requireAuth as ReturnType<typeof vi.fn>).mockImplementation(
    async (req: { headers: Record<string, string>; userId: number }, reply: { status: (n: number) => { send: (v: unknown) => void }; sent: boolean }) => {
      const id = req.headers['x-user-id'];
      if (!id) {
        reply.status(401).send({ ok: false, error: 'Unauthorized', code: 'unauthorized' });
        return;
      }
      req.userId = parseInt(id, 10);
    },
  );
}

function makePipelineSuccess(overrides: Record<string, unknown> = {}) {
  return {
    canSave: true,
    canPublish: false,
    hasErrors: false,
    hasWarnings: true,
    diagnostics: [{ code: 'missing_event_id', severity: 'warning', message: 'Missing event ID' }],
    parseResult: {
      ok: true,
      raw: { event: { slug: 'nvc', name: 'No Variant Challenge' } },
      diagnostics: [],
    },
    ...overrides,
  };
}

describe('Events admin routes', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockPassOrganiser();
    mockPassAuth();
    app = await buildServer();
    await app.ready();
  });

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  it('POST /api/admin/events/:id/save — valid YAML → canSave: true, section row updated', async () => {
    const mockDb = db as unknown as MockDb;

    // variantRegistry select
    mockDb.select.mockReturnValueOnce(makeSelectChain([]));
    // pipeline returns canSave: true
    (runPipeline as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makePipelineSuccess());
    // sections update with returning
    mockDb.update.mockReturnValueOnce(makeUpdateWithReturningChain([{ id: 10 }]));

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/events/10/save',
      headers: { 'x-user-id': '42', 'content-type': 'application/json' },
      body: JSON.stringify({ yaml: 'event:\n  name: No Variant Challenge\n  slug: nvc\n' }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { canSave: boolean; eventId: number };
    expect(body.canSave).toBe(true);
    expect(body.eventId).toBe(10);
    expect(mockDb.update).toHaveBeenCalledOnce();
  });

  it('POST /api/admin/events/:id/save — invalid YAML → canSave: false, no DB write', async () => {
    const mockDb = db as unknown as MockDb;

    // variantRegistry select
    mockDb.select.mockReturnValueOnce(makeSelectChain([]));
    // pipeline returns canSave: false
    (runPipeline as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      canSave: false,
      canPublish: false,
      hasErrors: true,
      hasWarnings: false,
      diagnostics: [{ code: 'parse_error', severity: 'error', message: 'bad YAML' }],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/events/10/save',
      headers: { 'x-user-id': '42', 'content-type': 'application/json' },
      body: JSON.stringify({ yaml: '!!bad!!' }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { canSave: boolean };
    expect(body.canSave).toBe(false);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  it('GET /api/admin/events/:id — returns stored YAML and fresh pipeline result', async () => {
    const mockDb = db as unknown as MockDb;

    const storedYaml = 'event:\n  name: No Variant Challenge\n  slug: nvc\n';

    // sections select
    mockDb.select
      .mockReturnValueOnce(
        makeSelectChain([
          { id: 10, slug: 'nvc', name: 'No Variant Challenge', status: 'draft', config: { yaml: storedYaml } },
        ]),
      )
      // variantRegistry select
      .mockReturnValueOnce(makeSelectChain([]))
      // warningAcknowledgements select
      .mockReturnValueOnce(makeSelectChain([]));

    (runPipeline as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makePipelineSuccess());

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/events/10',
      headers: { 'x-user-id': '42' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { id: number; slug: string; yaml: string; canSave: boolean; acknowledgedWarnings: string[] };
    expect(body.id).toBe(10);
    expect(body.slug).toBe('nvc');
    expect(body.yaml).toBe(storedYaml);
    expect(body.canSave).toBe(true);
    expect(body.acknowledgedWarnings).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Publish — warning gate
  // ---------------------------------------------------------------------------

  it('POST /api/admin/events/:id/publish — 400 when warnings not acknowledged', async () => {
    const mockDb = db as unknown as MockDb;

    mockDb.select
      // sections
      .mockReturnValueOnce(
        makeSelectChain([
          { id: 10, slug: 'nvc', name: 'NVC', status: 'draft', config: { yaml: 'event:\n  name: NVC\n  slug: nvc\n' } },
        ]),
      )
      // variantRegistry
      .mockReturnValueOnce(makeSelectChain([]))
      // warningAcknowledgements — none
      .mockReturnValueOnce(makeSelectChain([]));

    (runPipeline as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      canSave: true,
      canPublish: false,
      hasErrors: false,
      hasWarnings: true,
      diagnostics: [{ code: 'test_warning', severity: 'warning', message: 'Test warning' }],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/events/10/publish',
      headers: { 'x-user-id': '42' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { code: string; unacknowledged: string[] };
    expect(body.code).toBe('unacknowledged_warnings');
    expect(body.unacknowledged).toContain('test_warning');
  });

  // ---------------------------------------------------------------------------
  // Publish — 100 specs
  // ---------------------------------------------------------------------------

  it('POST /api/admin/events/:id/publish — inserts 100 specs for event with 100 slots', async () => {
    const mockDb = db as unknown as MockDb;

    const slots = Array.from({ length: 100 }, (_, i) => ({
      seed_pattern: `e{eventID}g${i}`,
      slot_index: i,
    }));

    mockDb.select
      // sections
      .mockReturnValueOnce(
        makeSelectChain([
          { id: 10, slug: 'nvc', name: 'NVC', status: 'draft', config: { yaml: 'event:\n  name: NVC\n  slug: nvc\n' } },
        ]),
      )
      // variantRegistry
      .mockReturnValueOnce(makeSelectChain([]))
      // gameSpecs — no existing
      .mockReturnValueOnce(makeSelectChain([]));

    (runPipeline as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      canSave: true,
      canPublish: true,
      hasErrors: false,
      hasWarnings: false,
      diagnostics: [],
      expandedConfig: {
        diagnostics: [],
        root: {
          sections: [{ sections: [], slots }],
          slots: [],
        },
      },
    });

    mockDb.insert.mockReturnValueOnce(makeInsertChain());
    mockDb.update.mockReturnValueOnce(makeUpdateChain());

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/events/10/publish',
      headers: { 'x-user-id': '42' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { ok: boolean; specsRegistered: number };
    expect(body.ok).toBe(true);
    expect(body.specsRegistered).toBe(100);
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  it('POST /api/admin/events/:id/save — 403 for non-organiser', async () => {
    (requireOrganiser as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (_req: unknown, reply: { status: (n: number) => { send: (v: unknown) => void } }) => {
        reply.status(403).send({ ok: false, error: 'Forbidden', code: 'forbidden' });
      },
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/events/10/save',
      headers: { 'x-user-id': '99', 'content-type': 'application/json' },
      body: JSON.stringify({ yaml: 'event:\n  name: NVC\n  slug: nvc\n' }),
    });

    expect(res.statusCode).toBe(403);
  });
});
