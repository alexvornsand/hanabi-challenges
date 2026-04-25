import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onSlotCompleted, onAdminTrigger, onAttemptStart } from './slotTriggerEngine.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

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

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
}

describe('slotTriggerEngine', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    vi.resetAllMocks();
    mockDb = db as unknown as MockDb;
  });

  // ---------------------------------------------------------------------------
  // onSlotCompleted
  // ---------------------------------------------------------------------------

  it('onSlotCompleted — issues next completion slot when one exists', async () => {
    // completed slot
    mockDb.select
      .mockReturnValueOnce(
        makeSelectChain([
          {
            id: 1,
            sectionId: 10,
            slotIndex: 0,
            assignmentTrigger: 'lazy',
            lazyTrigger: 'completion',
            status: 'issued',
            config: {},
          },
        ]),
      )
      // next pending slot
      .mockReturnValueOnce(
        makeSelectChain([
          {
            id: 2,
            sectionId: 10,
            slotIndex: 1,
            assignmentTrigger: 'lazy',
            lazyTrigger: 'completion',
            status: 'pending',
            config: { seed_pattern: 's{sectionID}g{slotIndex*}' },
          },
        ]),
      );

    mockDb.insert.mockReturnValueOnce(makeInsertChain()); // gameSpecs insert
    mockDb.update.mockReturnValueOnce(makeUpdateChain()); // slot status update

    await onSlotCompleted(1, db as Parameters<typeof onSlotCompleted>[1]);

    expect(mockDb.insert).toHaveBeenCalledOnce();
    expect(mockDb.update).toHaveBeenCalledOnce();
  });

  it('onSlotCompleted — last slot in sequence, no new slot issued', async () => {
    // completed slot
    mockDb.select
      .mockReturnValueOnce(
        makeSelectChain([
          {
            id: 1,
            sectionId: 10,
            slotIndex: 2,
            assignmentTrigger: 'lazy',
            lazyTrigger: 'completion',
            status: 'issued',
            config: {},
          },
        ]),
      )
      // no next slot
      .mockReturnValueOnce(makeSelectChain([]));

    await onSlotCompleted(1, db as Parameters<typeof onSlotCompleted>[1]);

    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // onAdminTrigger
  // ---------------------------------------------------------------------------

  it('onAdminTrigger — admin_sequence generator issues new slot and spec', async () => {
    // generator
    mockDb.select
      .mockReturnValueOnce(
        makeSelectChain([
          {
            id: 5,
            sectionId: 10,
            position: 0,
            triggerType: 'admin_sequence',
            generatorConfig: { seed_pattern: 's{sectionID}g{slotIndex*}' },
          },
        ]),
      )
      // existing slots count
      .mockReturnValueOnce(makeSelectChain([{ id: 1 }, { id: 2 }]));

    mockDb.insert
      .mockReturnValueOnce(makeInsertChain([{ id: 3 }])) // slots insert → returns new slot
      .mockReturnValueOnce(makeInsertChain()); // gameSpecs insert

    await onAdminTrigger(10, 'sequence.count', db as Parameters<typeof onAdminTrigger>[2]);

    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  // ---------------------------------------------------------------------------
  // onAttemptStart
  // ---------------------------------------------------------------------------

  it('onAttemptStart — attempt_start generator issues new slot for the unit', async () => {
    mockDb.select
      // triggering slot
      .mockReturnValueOnce(
        makeSelectChain([{ id: 1, sectionId: 7, slotIndex: 0, config: {} }]),
      )
      // generator
      .mockReturnValueOnce(
        makeSelectChain([
          {
            id: 9,
            sectionId: 7,
            position: 0,
            triggerType: 'attempt_start',
            generatorConfig: { seed_pattern: 's{sectionID}g{slotIndex*}' },
          },
        ]),
      )
      // existing slots count
      .mockReturnValueOnce(makeSelectChain([{ id: 10 }]));

    mockDb.insert
      .mockReturnValueOnce(makeInsertChain([{ id: 11 }])) // slots insert
      .mockReturnValueOnce(makeInsertChain()); // gameSpecs insert

    await onAttemptStart(1, 42, db as Parameters<typeof onAttemptStart>[2]);

    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });
});
