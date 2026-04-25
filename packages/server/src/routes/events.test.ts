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
  );
}

function mockPassAuth() {
  (requireAuth as ReturnType<typeof vi.fn>).mockImplementation(
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

describe('Events admin routes — Ticket 021 (save / load / publish)', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockPassOrganiser();
    mockPassAuth();
    app = await buildServer();
    await app.ready();
  });

  it('POST /api/admin/events/:id/save — valid YAML → canSave: true, section row updated', async () => {
    const mockDb = db as unknown as MockDb;

    mockDb.select.mockReturnValueOnce(makeSelectChain([]));
    (runPipeline as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makePipelineSuccess());
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

    mockDb.select.mockReturnValueOnce(makeSelectChain([]));
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

  it('GET /api/admin/events/:id — returns stored YAML and fresh pipeline result', async () => {
    const mockDb = db as unknown as MockDb;
    const storedYaml = 'event:\n  name: No Variant Challenge\n  slug: nvc\n';

    mockDb.select
      .mockReturnValueOnce(
        makeSelectChain([
          {
            id: 10,
            slug: 'nvc',
            name: 'No Variant Challenge',
            status: 'draft',
            config: { yaml: storedYaml },
          },
        ]),
      )
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    (runPipeline as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makePipelineSuccess());

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/events/10',
      headers: { 'x-user-id': '42' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      id: number;
      slug: string;
      yaml: string;
      canSave: boolean;
      acknowledgedWarnings: string[];
    };
    expect(body.id).toBe(10);
    expect(body.slug).toBe('nvc');
    expect(body.yaml).toBe(storedYaml);
    expect(body.canSave).toBe(true);
    expect(body.acknowledgedWarnings).toEqual([]);
  });

  it('POST /api/admin/events/:id/publish — 400 when warnings not acknowledged', async () => {
    const mockDb = db as unknown as MockDb;

    mockDb.select
      .mockReturnValueOnce(
        makeSelectChain([
          {
            id: 10,
            slug: 'nvc',
            name: 'NVC',
            status: 'draft',
            config: { yaml: 'event:\n  name: NVC\n  slug: nvc\n' },
          },
        ]),
      )
      .mockReturnValueOnce(makeSelectChain([]))
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

  it('POST /api/admin/events/:id/publish — inserts 100 specs for event with 100 slots', async () => {
    const mockDb = db as unknown as MockDb;

    const slots = Array.from({ length: 100 }, (_, i) => ({
      seed_pattern: `e{eventID}g${i}`,
      slot_index: i,
    }));

    mockDb.select
      .mockReturnValueOnce(
        makeSelectChain([
          {
            id: 10,
            slug: 'nvc',
            name: 'NVC',
            status: 'draft',
            config: { yaml: 'event:\n  name: NVC\n  slug: nvc\n' },
          },
        ]),
      )
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([]));

    (runPipeline as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      canSave: true,
      canPublish: true,
      hasErrors: false,
      hasWarnings: false,
      diagnostics: [],
      expandedConfig: {
        diagnostics: [],
        root: { sections: [{ sections: [], slots }], slots: [] },
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

  it('POST /api/admin/events/:id/save — 403 for non-organiser', async () => {
    (requireOrganiser as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (
        _req: unknown,
        reply: { status: (n: number) => { send: (v: unknown) => void } },
      ) => {
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

// ---------------------------------------------------------------------------
// Ticket 022 — Admin inputs and panel state
// ---------------------------------------------------------------------------

describe('Events admin routes — Ticket 022 (admin inputs)', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    mockPassOrganiser();
    mockPassAuth();
    app = await buildServer();
    await app.ready();
  });

  it('POST /api/admin/events/:id/inputs/:fieldPath — persists time_window.start to admin_inputs', async () => {
    const mockDb = db as unknown as MockDb;
    mockDb.insert.mockReturnValueOnce(makeInsertChain());

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/events/10/inputs/time_window.start',
      headers: { 'x-user-id': '42', 'content-type': 'application/json' },
      body: JSON.stringify({ value: '2026-06-01T10:00:00Z' }),
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { ok: boolean; fieldPath: string; value: string };
    expect(body.ok).toBe(true);
    expect(body.fieldPath).toBe('time_window.start');
    expect(body.value).toBe('2026-06-01T10:00:00Z');
    expect(mockDb.insert).toHaveBeenCalledOnce();
  });

  it('POST /api/admin/events/:id/inputs/:fieldPath — unknown field path → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/events/10/inputs/some.unknown.field',
      headers: { 'x-user-id': '42', 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'anything' }),
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { code: string };
    expect(body.code).toBe('unknown_field_path');
  });

  it('POST /api/admin/events/:id/inputs/:fieldPath — non-ISO date for datetime field → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/events/10/inputs/time_window.start',
      headers: { 'x-user-id': '42', 'content-type': 'application/json' },
      body: JSON.stringify({ value: 'June 1 2026' }),
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body) as { code: string };
    expect(body.code).toBe('invalid_value');
  });

  it('POST /api/admin/events/:id/inputs/:fieldPath — non-organiser → 403', async () => {
    (requireOrganiser as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async (
        _req: unknown,
        reply: { status: (n: number) => { send: (v: unknown) => void } },
      ) => {
        reply.status(403).send({ ok: false, error: 'Forbidden', code: 'forbidden' });
      },
    );

    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/events/10/inputs/time_window.start',
      headers: { 'x-user-id': '99', 'content-type': 'application/json' },
      body: JSON.stringify({ value: '2026-06-01T10:00:00Z' }),
    });

    expect(res.statusCode).toBe(403);
  });

  it('GET /api/admin/events/:id/manage — returns pending inputs with correct actionability', async () => {
    const mockDb = db as unknown as MockDb;

    mockDb.select
      // sections — event is published
      .mockReturnValueOnce(
        makeSelectChain([
          {
            id: 10,
            slug: 'nvc',
            name: 'No Variant Challenge',
            status: 'published',
            config: { yaml: 'event:\n  name: NVC\n  slug: nvc\n' },
          },
        ]),
      )
      // variantRegistry
      .mockReturnValueOnce(makeSelectChain([]))
      // adminInputs
      .mockReturnValueOnce(makeSelectChain([]));

    // expandedConfig with time_window.start = 'admin' on root section
    (runPipeline as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      canSave: true,
      canPublish: false,
      hasErrors: false,
      hasWarnings: true,
      diagnostics: [],
      expandedConfig: {
        diagnostics: [],
        root: {
          name: 'No Variant Challenge',
          slug: 'nvc',
          time_window: { start: 'admin' },
          matchmaking: { type: 'none' },
          sections: [],
          slots: [],
          awards: [],
          scoreboards: [],
          capture_policy: {},
          registration_policy: {},
          visibility_policy: {},
          non_participant_result: '"0"',
          scoring_unit_type: 'individual',
          section_type: 'branch',
          position: 0,
        },
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/events/10/manage',
      headers: { 'x-user-id': '42' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as {
      pendingInputs: Array<{
        fieldPath: string;
        controlType: string;
        isActionable: boolean;
      }>;
    };
    expect(body.pendingInputs).toHaveLength(1);
    expect(body.pendingInputs[0].fieldPath).toContain('time_window.start');
    expect(body.pendingInputs[0].controlType).toBe('datetime');
    expect(body.pendingInputs[0].isActionable).toBe(true);
  });
});
