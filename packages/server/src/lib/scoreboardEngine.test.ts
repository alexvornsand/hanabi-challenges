import { describe, it, expect } from 'vitest';
import type { ScoringUnitSnapshot, ExpandedConfig, ExpandedSection } from '@hanabi/dsl';
import { computeScoreboardFromData } from './scoreboardEngine.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeUnit(id: number, score: number, rank: number, overrides: Partial<ScoringUnitSnapshot> = {}): ScoringUnitSnapshot {
  return {
    id,
    name: `Unit ${id}`,
    type: 'individual',
    score,
    rank,
    slot_results: [],
    section_scores: {},
    section_ranks: {},
    member_ids: [],
    ...overrides,
  };
}

function makeExpandedConfig(overrides: Partial<ExpandedSection> = {}): ExpandedConfig {
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
      awards: [],
      scoreboards: [],
      sections: [],
      slots: [],
      ...overrides,
    },
    diagnostics: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeScoreboardFromData', () => {
  it('NVC fixture — units sorted by score descending', () => {
    const units = [
      makeUnit(1, 49, 1),
      makeUnit(2, 20, 2),
      makeUnit(3, 35, 3),
      makeUnit(4, 45, 4),
      makeUnit(5, 10, 5),
    ];

    const scoreboard = {
      name: 'NVC Main',
      scope: 'Main',
      rank_by: {
        primary: { expr: 'unit.score', direction: 'descending' as const },
      },
      columns: [{ label: 'Score', value: 'unit.score' }],
      row_styles: [],
    };

    const result = computeScoreboardFromData(scoreboard, makeExpandedConfig(), { units });

    expect(result.rows[0]!.unitId).toBe(1); // score 49
    expect(result.rows[1]!.unitId).toBe(4); // score 45
    expect(result.rows[2]!.unitId).toBe(3); // score 35
    expect(result.rows[0]!.displayRank).toBe(1);
    expect(result.rows[1]!.displayRank).toBe(2);
  });

  it('filter: "unit.score > 0" → excludes zero-score units', () => {
    const units = [
      makeUnit(1, 25, 1),
      makeUnit(2, 0, 2),
      makeUnit(3, 15, 3),
    ];

    const scoreboard = {
      name: 'Filtered',
      scope: 'Main',
      filter: 'unit.score > 0',
      rank_by: {
        primary: { expr: 'unit.score', direction: 'descending' as const },
      },
      columns: [],
      row_styles: [],
    };

    const result = computeScoreboardFromData(scoreboard, makeExpandedConfig(), { units });

    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((r) => r.unitId)).not.toContain(2);
  });

  it('featured: "false" → scoreboard not featured', () => {
    const units = [makeUnit(1, 10, 1)];

    const scoreboard = {
      name: 'Hidden',
      scope: 'Main',
      featured: 'false',
      rank_by: {
        primary: { expr: 'unit.score', direction: 'descending' as const },
      },
      columns: [],
      row_styles: [],
    };

    const result = computeScoreboardFromData(scoreboard, makeExpandedConfig(), { units });
    expect(result.featured).toBe(false);
  });

  it('featured defaults to true', () => {
    const units = [makeUnit(1, 10, 1)];

    const scoreboard = {
      name: 'Visible',
      scope: 'Main',
      rank_by: {
        primary: { expr: 'unit.score', direction: 'descending' as const },
      },
      columns: [],
      row_styles: [],
    };

    const result = computeScoreboardFromData(scoreboard, makeExpandedConfig(), { units });
    expect(result.featured).toBe(true);
  });

  it('row style applied when predicate matches', () => {
    const units = [makeUnit(1, 49, 1), makeUnit(2, 20, 2)];

    const scoreboard = {
      name: 'Styled',
      scope: 'Main',
      rank_by: {
        primary: { expr: 'unit.score', direction: 'descending' as const },
      },
      columns: [],
      row_styles: [
        { predicate: 'unit.score >= 40', accent: 'gold' as const, label: 'Top', priority: 1 },
        { predicate: 'unit.score < 40', accent: 'silver' as const, label: 'Mid', priority: 0 },
      ],
    };

    const result = computeScoreboardFromData(scoreboard, makeExpandedConfig(), { units });

    const row1 = result.rows.find((r) => r.unitId === 1)!;
    const row2 = result.rows.find((r) => r.unitId === 2)!;

    expect(row1.rowStyle?.accent).toBe('gold');
    expect(row2.rowStyle?.accent).toBe('silver');
  });

  it('derived ranking scoreboard — units ranked by external score', () => {
    const units = [
      makeUnit(1, 0, 0, { section_scores: { 'Week 1': 30 } }),
      makeUnit(2, 0, 0, { section_scores: { 'Week 1': 50 } }),
      makeUnit(3, 0, 0, { section_scores: { 'Week 1': 20 } }),
    ];

    // Manually set scores based on section_scores (simplified)
    for (const u of units) {
      u.score = u.section_scores['Week 1'] ?? 0;
    }

    const scoreboard = {
      name: 'Derived',
      scope: 'Main',
      rank_by: {
        primary: { expr: 'unit.score', direction: 'descending' as const },
      },
      columns: [{ label: 'Score', value: 'unit.score' }],
      row_styles: [],
    };

    const result = computeScoreboardFromData(scoreboard, makeExpandedConfig(), { units });

    expect(result.rows[0]!.unitId).toBe(2); // score 50
    expect(result.rows[1]!.unitId).toBe(1); // score 30
    expect(result.rows[2]!.unitId).toBe(3); // score 20
  });

  it('PR status attached to rows', () => {
    const units = [makeUnit(1, 10, 1)];
    const prResults = [
      { unitType: 'individual', unitId: 1, promotionStatus: 'promoted', nextDivision: 'Gold' },
    ];

    const scoreboard = {
      name: 'PR Test',
      scope: 'Main',
      rank_by: { primary: { expr: 'unit.score', direction: 'descending' as const } },
      columns: [],
      row_styles: [],
    };

    const result = computeScoreboardFromData(scoreboard, makeExpandedConfig(), { units, prResults });
    expect(result.rows[0]!.promotionStatus).toBe('promoted');
    expect(result.rows[0]!.nextDivision).toBe('Gold');
  });
});
