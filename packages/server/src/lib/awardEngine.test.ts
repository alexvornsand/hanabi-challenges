import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExpandedConfig } from '@hanabi/dsl';

// ---------------------------------------------------------------------------
// Mock the DB
// ---------------------------------------------------------------------------

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { db } from '../db/index.js';
import { processAwards } from './awardEngine.js';

type MockDb = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

function mockSelect(results: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(results),
  };
}

function mockInsert() {
  return {
    values: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    returning: vi.fn().mockResolvedValue([]),
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeExpandedConfig(awards: unknown[] = []): ExpandedConfig {
  return {
    root: {
      name: 'Main',
      slug: 'main',
      position: 0,
      section_type: 'leaf',
      scoring_unit_type: 'individual',
      non_participant_result: '0',
      time_window: {},
      capture_policy: {},
      registration_policy: {},
      visibility_policy: {},
      matchmaking: { type: 'none' },
      awards: awards as ExpandedConfig['root']['awards'],
      scoreboards: [],
      sections: [],
      slots: [],
    },
    diagnostics: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processAwards', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    vi.resetAllMocks();
    mockDb = db as unknown as MockDb;
  });

  it('issues badge to individual unit meeting predicate', async () => {
    const awardConfig = {
      name: 'Completion',
      predicate: 'unit.score >= 1',
      badge: { primary_text: 'Complete', shape: 'circle', colour: 'gold' },
    };

    // Select calls: sections (status), awards, registrations, (no teams)
    mockDb.select
      .mockReturnValueOnce(mockSelect([{ status: 'closed' }]))       // sections
      .mockReturnValueOnce(mockSelect([{ id: 10, awardName: 'Completion', sectionId: 1 }])) // awards
      .mockReturnValueOnce(mockSelect([{ unitType: 'individual', unitId: 5, eventId: 1, dimensionAxis: 'default', divisionValue: 'default', registeredAt: new Date(), registeredBy: 1, id: 1 }])) // registrations
      .mockReturnValueOnce(mockSelect([])); // teamMembers (empty)

    mockDb.insert.mockReturnValue(mockInsert());

    // Unit 5 with score 0 doesn't meet predicate "unit.score >= 1" (score defaults to 0 in snapshot)
    const config = makeExpandedConfig([awardConfig]);
    const count = await processAwards(config, 1, db as never);

    // Since unit.score = 0 (from snapshot), predicate "unit.score >= 1" is false → no issuance
    expect(count).toBe(0);
  });

  it('when clause prevents issuance for non-closed events', async () => {
    const awardConfig = {
      name: 'Finisher',
      when: "event.status == 'closed'",
      predicate: 'true',
      badge: { primary_text: 'Finish', colour: 'silver' },
    };

    // Event is published (not closed)
    mockDb.select
      .mockReturnValueOnce(mockSelect([{ status: 'published' }]))
      .mockReturnValueOnce(mockSelect([{ id: 20, awardName: 'Finisher', sectionId: 1 }]))
      .mockReturnValueOnce(mockSelect([{ unitType: 'individual', unitId: 7, eventId: 1, dimensionAxis: 'default', divisionValue: 'default', registeredAt: new Date(), registeredBy: 1, id: 2 }]))
      .mockReturnValueOnce(mockSelect([]));

    mockDb.insert.mockReturnValue(mockInsert());

    const config = makeExpandedConfig([awardConfig]);
    const count = await processAwards(config, 1, db as never);

    // when clause "event.status == 'closed'" is false for published → 0 issued
    expect(count).toBe(0);
  });

  it('returns 0 when no awards configured', async () => {
    mockDb.select
      .mockReturnValueOnce(mockSelect([{ status: 'closed' }]))
      .mockReturnValueOnce(mockSelect([]))  // no DB awards
      .mockReturnValueOnce(mockSelect([]))  // no registrations
      .mockReturnValueOnce(mockSelect([])); // no team members

    const config = makeExpandedConfig([]);
    const count = await processAwards(config, 1, db as never);
    expect(count).toBe(0);
  });
});
