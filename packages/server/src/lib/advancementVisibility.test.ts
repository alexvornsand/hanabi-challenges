import { describe, it, expect } from 'vitest';
import type { ScoringUnitSnapshot, EventSnapshot, SectionSnapshot } from '@hanabi/dsl';
import { evalExpr } from '@hanabi/dsl/src/runtimeExpr/evaluator.js';
import { computeAdvancementPure } from './advancementEngine.js';
import { evaluateResultsVisible, evaluateSpecsVisible } from './visibilityEngine.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeUnit(id: number, rank: number): ScoringUnitSnapshot {
  return {
    id,
    name: `Unit ${id}`,
    type: 'individual',
    score: 0,
    rank,
    slot_results: [],
    section_scores: {},
    section_ranks: {},
    member_ids: [],
  };
}

const OPEN_EVENT: EventSnapshot = {
  slug: 'test',
  name: 'Test Event',
  status: 'published',
  sections: {},
};

const CLOSED_EVENT: EventSnapshot = {
  ...OPEN_EVENT,
  status: 'closed',
};

const SECTION: SectionSnapshot = {
  name: 'Main',
  status: 'published',
  time_window: {},
  results: [],
};

// ---------------------------------------------------------------------------
// advancementEngine
// ---------------------------------------------------------------------------

describe('computeAdvancementPure', () => {
  it('advancement.predicate: "unit.rank <= 3" → top 3 advancing', () => {
    const units = [
      makeUnit(1, 1),
      makeUnit(2, 2),
      makeUnit(3, 3),
      makeUnit(4, 4),
      makeUnit(5, 5),
    ];

    const results = computeAdvancementPure(
      'unit.rank <= 3',
      units,
      SECTION,
      OPEN_EVENT,
      evalExpr,
    );

    const advancing = results.filter((r) => r.advances).map((r) => r.unitId);
    expect(advancing).toEqual([1, 2, 3]);
    expect(results.find((r) => r.unitId === 4)?.advances).toBe(false);
    expect(results.find((r) => r.unitId === 5)?.advances).toBe(false);
  });

  it('all units advance when predicate is true', () => {
    const units = [makeUnit(1, 1), makeUnit(2, 2)];
    const results = computeAdvancementPure('true', units, SECTION, OPEN_EVENT, evalExpr);
    expect(results.every((r) => r.advances)).toBe(true);
  });

  it('no units advance when predicate is false', () => {
    const units = [makeUnit(1, 1), makeUnit(2, 2)];
    const results = computeAdvancementPure('false', units, SECTION, OPEN_EVENT, evalExpr);
    expect(results.every((r) => !r.advances)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// visibilityEngine
// ---------------------------------------------------------------------------

describe('evaluateResultsVisible', () => {
  it('no policy → visible', () => {
    expect(evaluateResultsVisible({}, OPEN_EVENT)).toBe(true);
  });

  it('results_visible: "event.status == \'closed\'" → hidden while open', () => {
    const policy = { results_visible: "event.status == 'closed'" };
    expect(evaluateResultsVisible(policy, OPEN_EVENT)).toBe(false);
  });

  it('results_visible: "event.status == \'closed\'" → visible after close', () => {
    const policy = { results_visible: "event.status == 'closed'" };
    expect(evaluateResultsVisible(policy, CLOSED_EVENT)).toBe(true);
  });
});

describe('evaluateSpecsVisible', () => {
  it('no policy → visible', () => {
    expect(evaluateSpecsVisible({}, OPEN_EVENT)).toBe(true);
  });

  it('specs_visible: "false" → not visible', () => {
    expect(evaluateSpecsVisible({ specs_visible: 'false' }, OPEN_EVENT)).toBe(false);
  });

  it('specs_visible: "true" → visible', () => {
    expect(evaluateSpecsVisible({ specs_visible: 'true' }, OPEN_EVENT)).toBe(true);
  });
});
