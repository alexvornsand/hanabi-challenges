import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseConfig } from './parser.js';
import { resolveConfig } from './resolver.js';
import { expandConfig } from './expander.js';
import { checkSufficiency } from './sufficiency.js';
import type { ExpandedConfig, ExpandedSection } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): string {
  return readFileSync(join(__dirname, '__fixtures__', name), 'utf-8');
}

function buildConfig(yaml: string): ExpandedConfig {
  const parsed = parseConfig(yaml);
  if (!parsed.ok) throw new Error(`Parse error: ${JSON.stringify(parsed.diagnostics)}`);
  const resolved = resolveConfig(parsed);
  return expandConfig(resolved, new Map());
}

function makeRoot(overrides: Partial<ExpandedSection> = {}): ExpandedSection {
  return {
    name: 'Test Event',
    position: 0,
    section_type: 'leaf',
    scoring_unit_type: 'individual',
    non_participant_result: '"0"',
    time_window: {},
    capture_policy: { scrape: false, submit: true },
    registration_policy: { implicit: true },
    visibility_policy: {},
    matchmaking: { type: 'none' },
    awards: [],
    scoreboards: [],
    sections: [],
    slots: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fixture tests
// ---------------------------------------------------------------------------

describe('NVC fixture', () => {
  it('emits multi_reg_no_team_id and missing_event_id', () => {
    const config = buildConfig(loadFixture('nvc.yaml'));
    const diags = checkSufficiency(config);
    const codes = diags.map((d) => d.code);
    expect(codes).toContain('multi_reg_no_team_id');
    expect(codes).toContain('missing_event_id');
  });

  it('does not emit errors', () => {
    const config = buildConfig(loadFixture('nvc.yaml'));
    const diags = checkSufficiency(config);
    expect(diags.filter((d) => d.severity === 'error')).toHaveLength(0);
  });
});

describe('Mix Gauntlet fixture', () => {
  it('emits zero warnings', () => {
    const config = buildConfig(loadFixture('gauntlet.yaml'));
    const diags = checkSufficiency(config);
    const warnings = diags.filter((d) => d.severity === 'warning');
    expect(warnings).toHaveLength(0);
  });
});

describe('Boom and Bloom fixture', () => {
  it('emits zero warnings', () => {
    const config = buildConfig(loadFixture('boom-and-bloom.yaml'));
    const diags = checkSufficiency(config);
    const warnings = diags.filter((d) => d.severity === 'warning');
    expect(warnings).toHaveLength(0);
  });

  it('emits one admin_input_required notice (lazy_trigger: admin)', () => {
    const config = buildConfig(loadFixture('boom-and-bloom.yaml'));
    const diags = checkSufficiency(config);
    const notices = diags.filter(
      (d) => d.severity === 'notice' && d.code === 'admin_input_required',
    );
    expect(notices).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Individual check tests
// ---------------------------------------------------------------------------

describe('pool_no_roster', () => {
  it('pool_units_allowed:true + implicit-only → warning', () => {
    const root = makeRoot({
      registration_policy: { implicit: true, pool_units_allowed: true },
    });
    const diags = checkSufficiency({ root, diagnostics: [] });
    expect(diags.some((d) => d.code === 'pool_no_roster')).toBe(true);
  });

  it('pool_units_allowed:true + explicit → no warning', () => {
    const root = makeRoot({
      registration_policy: { implicit: true, explicit: true, pool_units_allowed: true },
    });
    const diags = checkSufficiency({ root, diagnostics: [] });
    expect(diags.some((d) => d.code === 'pool_no_roster')).toBe(false);
  });
});

describe('organizer_dim_self_reg', () => {
  it('organizer_assigned dimension → warning', () => {
    const root = makeRoot({
      dimensions: [{ axis: 'player_count_class', values: ['2p'], registration_cardinality: 'organizer_assigned' }],
    });
    const diags = checkSufficiency({ root, diagnostics: [] });
    expect(diags.some((d) => d.code === 'organizer_dim_self_reg')).toBe(true);
  });
});

describe('multi_reg_no_team_id', () => {
  it('multiple cardinality + explicit + no teamID in patterns → warning', () => {
    const root = makeRoot({
      dimensions: [{ axis: 'player_count_class', values: ['2p'], registration_cardinality: 'multiple' }],
      registration_policy: { implicit: true, explicit: true },
      slots: [{ seed_pattern: 'NVC1', slot_index: 1 }],
    });
    const diags = checkSufficiency({ root, diagnostics: [] });
    expect(diags.some((d) => d.code === 'multi_reg_no_team_id')).toBe(true);
  });

  it('multiple cardinality + teamID in pattern → no warning', () => {
    const root = makeRoot({
      dimensions: [{ axis: 'player_count_class', values: ['2p'], registration_cardinality: 'multiple' }],
      registration_policy: { implicit: true, explicit: true },
      slots: [{ seed_pattern: '{teamID}v1', slot_index: 1 }],
    });
    const diags = checkSufficiency({ root, diagnostics: [] });
    expect(diags.some((d) => d.code === 'multi_reg_no_team_id')).toBe(false);
  });
});

describe('tag_scrape_conflict', () => {
  it('tag_present validity rule + scrape:true → warning', () => {
    const root = makeRoot({
      capture_policy: { scrape: true, submit: true },
      slots: [{
        seed_pattern: 'X1',
        slot_index: 1,
        validity_rules: [{ predicate: 'tag_present(tag: "rated")' }],
      }],
    });
    const diags = checkSufficiency({ root, diagnostics: [] });
    expect(diags.some((d) => d.code === 'tag_scrape_conflict')).toBe(true);
  });
});

describe('forced_no_preassembly', () => {
  it('algorithmic matchmaking with fixed assignment + no eligibility → warning', () => {
    const root = makeRoot({
      matchmaking: { type: 'algorithmic', assignment: 4 } as typeof root['matchmaking'],
    });
    const diags = checkSufficiency({ root, diagnostics: [] });
    expect(diags.some((d) => d.code === 'forced_no_preassembly')).toBe(true);
  });

  it('algorithmic matchmaking with eligibility → no warning', () => {
    const root = makeRoot({
      matchmaking: { type: 'algorithmic', assignment: 4, eligibility: 'unit.rating > 1000' } as typeof root['matchmaking'],
    });
    const diags = checkSufficiency({ root, diagnostics: [] });
    expect(diags.some((d) => d.code === 'forced_no_preassembly')).toBe(false);
  });

  it('algorithmic matchmaking with dynamic assignment → no warning even without eligibility', () => {
    const root = makeRoot({
      matchmaking: { type: 'algorithmic', assignment: 'dynamic' } as typeof root['matchmaking'],
    });
    const diags = checkSufficiency({ root, diagnostics: [] });
    expect(diags.some((d) => d.code === 'forced_no_preassembly')).toBe(false);
  });
});

describe('attempt_no_attempt_id', () => {
  it('attempt_modifier.enabled + no {attemptID} → warning', () => {
    const root = makeRoot({
      slots: [{
        seed_pattern: 'e1g1',
        slot_index: 1,
        attempt_modifier: { enabled: true, count: 3 },
      }],
    });
    const diags = checkSufficiency({ root, diagnostics: [] });
    expect(diags.some((d) => d.code === 'attempt_no_attempt_id')).toBe(true);
  });
});

describe('missing_event_id', () => {
  it('only slotIndex in patterns → warning', () => {
    const root = makeRoot({
      slots: [{ seed_pattern: 'prefix{slotIndex*}', slot_index: 1 }],
    });
    const diags = checkSufficiency({ root, diagnostics: [] });
    expect(diags.some((d) => d.code === 'missing_event_id')).toBe(true);
  });

  it('eventID in pattern → no warning', () => {
    const root = makeRoot({
      slots: [{ seed_pattern: '{eventID}g1', slot_index: 1 }],
    });
    const diags = checkSufficiency({ root, diagnostics: [] });
    expect(diags.some((d) => d.code === 'missing_event_id')).toBe(false);
  });

  it('teamID in pattern → no missing_event_id warning', () => {
    const root = makeRoot({
      slots: [{ seed_pattern: '{teamID}a1', slot_index: 1 }],
    });
    const diags = checkSufficiency({ root, diagnostics: [] });
    expect(diags.some((d) => d.code === 'missing_event_id')).toBe(false);
  });
});

describe('admin_input_required', () => {
  it('lazy_trigger:admin → notice', () => {
    const root = makeRoot({
      slots: [{ seed_pattern: 'X1', slot_index: 1, assignment_trigger: 'lazy', lazy_trigger: 'admin' }],
    });
    const diags = checkSufficiency({ root, diagnostics: [] });
    expect(diags.some((d) => d.code === 'admin_input_required' && d.severity === 'notice')).toBe(true);
  });

  it('time_window.start:admin → notice', () => {
    const root = makeRoot({
      time_window: { start: 'admin' },
    });
    const diags = checkSufficiency({ root, diagnostics: [] });
    expect(diags.some((d) => d.code === 'admin_input_required' && d.severity === 'notice')).toBe(true);
  });
});
