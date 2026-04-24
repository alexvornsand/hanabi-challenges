import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseConfig } from './parser.js';
import { resolveConfig } from './resolver.js';
import { expandConfig } from './expander.js';
import { validateExpanded } from './validator.js';
import { _resetIconCache } from './lib/materialIcons.js';
import type { ExpandedSection, ExpandedConfig, CapturePolicy, TimeWindow } from './types.js';

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

function makeConfig(root: ExpandedSection): ExpandedConfig {
  return { root, diagnostics: [] };
}

afterEach(() => {
  _resetIconCache();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Fixtures: zero errors
// ---------------------------------------------------------------------------

describe('fixtures — zero errors', () => {
  it('NVC fixture → zero errors', async () => {
    const config = buildConfig(loadFixture('nvc.yaml'));
    const diags = await validateExpanded(config);
    const errors = diags.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);
  }, 15_000);

  it('Boom and Bloom fixture → zero errors', async () => {
    const config = buildConfig(loadFixture('boom-and-bloom.yaml'));
    const diags = await validateExpanded(config);
    const errors = diags.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);
  }, 15_000);
});

// ---------------------------------------------------------------------------
// sections_and_slots_conflict
// ---------------------------------------------------------------------------

describe('sections_and_slots_conflict', () => {
  it('branch section with slots → error', async () => {
    const child = makeRoot({ name: 'Child', position: 1 });
    const root = makeRoot({
      section_type: 'branch',
      sections: [child],
      slots: [{ seed_pattern: 'X1', slot_index: 1 }],
    });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'sections_and_slots_conflict')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// aggregation_on_slot
// ---------------------------------------------------------------------------

describe('aggregation_on_slot', () => {
  it('slot with aggregation_function → error', async () => {
    const root = makeRoot({
      slots: [{ seed_pattern: 'X1', slot_index: 1, aggregation_function: { reduce: 'sum' } } as unknown as ReturnType<typeof makeRoot>['slots'][0]],
    });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'aggregation_on_slot')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// routing_on_non_leaf
// ---------------------------------------------------------------------------

describe('routing_on_non_leaf', () => {
  it('branch section with routing → error', async () => {
    const child = makeRoot({ name: 'Child', position: 1 });
    const root = makeRoot({
      section_type: 'branch',
      sections: [child],
      routing: { rank_1: { proceeds_to: 'Child' } },
    });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'routing_on_non_leaf')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// conditional_activation_on_root
// ---------------------------------------------------------------------------

describe('conditional_activation_on_root', () => {
  it('root with conditional_activation → error', async () => {
    const root = makeRoot({ conditional_activation: '"true"' });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'conditional_activation_on_root')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// root_only_field_on_non_root
// ---------------------------------------------------------------------------

describe('root_only_field_on_non_root', () => {
  it('non-root section with dimensions → error', async () => {
    const child = makeRoot({
      name: 'Child',
      position: 1,
      dimensions: [{ axis: 'player_count_class', values: ['2'], registration_cardinality: 'one_per_unit' }],
    });
    const root = makeRoot({ section_type: 'branch', sections: [child] });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'root_only_field_on_non_root')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// lazy_trigger_missing
// ---------------------------------------------------------------------------

describe('lazy_trigger_missing', () => {
  it('slot with assignment_trigger:lazy but no lazy_trigger → error', async () => {
    const root = makeRoot({
      slots: [{ seed_pattern: 'X1', slot_index: 1, assignment_trigger: 'lazy' }],
    });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'lazy_trigger_missing')).toBe(true);
  });

  it('slot with assignment_trigger:lazy and lazy_trigger set → no error', async () => {
    const root = makeRoot({
      slots: [{ seed_pattern: 'X1', slot_index: 1, assignment_trigger: 'lazy', lazy_trigger: 'completion' }],
    });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'lazy_trigger_missing')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// scrape_with_admin_window
// ---------------------------------------------------------------------------

describe('scrape_with_admin_window', () => {
  it('scrape:true + time_window.start:admin → error', async () => {
    const root = makeRoot({
      capture_policy: { scrape: true, submit: true } as CapturePolicy,
      time_window: { start: 'admin' } as TimeWindow,
    });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'scrape_with_admin_window')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// primary_scoreboard_count
// ---------------------------------------------------------------------------

describe('primary_scoreboard_count', () => {
  it('section with scoreboards but none primary → error', async () => {
    const root = makeRoot({
      scoreboards: [{
        name: 'Main',
        scope: 'event',
        primary: false,
        rank_by: { primary: { expr: 'unit.score', direction: 'descending' } },
        columns: [],
      }],
    });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'primary_scoreboard_count')).toBe(true);
  });

  it('two primary scoreboards → error', async () => {
    const root = makeRoot({
      scoreboards: [
        { name: 'A', scope: 'event', primary: true, rank_by: { primary: { expr: 'unit.score', direction: 'descending' } }, columns: [] },
        { name: 'B', scope: 'event', primary: true, rank_by: { primary: { expr: 'unit.score', direction: 'descending' } }, columns: [] },
      ],
    });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'primary_scoreboard_count')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// missing_classification_rule
// ---------------------------------------------------------------------------

describe('missing_classification_rule', () => {
  it('scoring_unit_type:inferred without classification_rule → error', async () => {
    const root = makeRoot({ scoring_unit_type: 'inferred' });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'missing_classification_rule')).toBe(true);
  });

  it('scoring_unit_type:inferred with classification_rule → no error', async () => {
    const root = makeRoot({ scoring_unit_type: 'inferred', classification_rule: 'unit.member_count > 1 ? "team" : "individual"' });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'missing_classification_rule')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// missing_unit_attribution
// ---------------------------------------------------------------------------

describe('missing_unit_attribution', () => {
  it('child unit type differs from branch parent without unit_attribution → error', async () => {
    const child = makeRoot({
      name: 'Child',
      position: 1,
      scoring_unit_type: 'team',
      // no unit_attribution
    });
    const root = makeRoot({
      section_type: 'branch',
      scoring_unit_type: 'individual',
      aggregation_function: { reduce: 'sum' },
      sections: [child],
    });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'missing_unit_attribution')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// string_on_structural_bool
// ---------------------------------------------------------------------------

describe('string_on_structural_bool', () => {
  it('scrape: "true" → error', async () => {
    const root = makeRoot({
      capture_policy: { scrape: 'true' as unknown as boolean, submit: true },
    });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'string_on_structural_bool')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// bool_on_expression_field
// ---------------------------------------------------------------------------

describe('bool_on_expression_field', () => {
  it('predicate: true → error', async () => {
    const root = makeRoot({
      awards: [{
        name: 'Test Award',
        predicate: true as unknown as string,
        badge: { primary_text: 'A', colour: 'gold' },
      }],
    });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'bool_on_expression_field')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// unknown_colour_token
// ---------------------------------------------------------------------------

describe('unknown_colour_token', () => {
  it('invalid colour on award badge → error', async () => {
    const root = makeRoot({
      awards: [{
        name: 'Test',
        predicate: '"true"',
        badge: { primary_text: 'A', colour: 'hot-pink-99' as unknown as ReturnType<typeof makeRoot>['awards'][0]['badge']['colour'] },
      }],
    });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'unknown_colour_token')).toBe(true);
  });

  it('valid colour → no error', async () => {
    const root = makeRoot({
      awards: [{
        name: 'Test',
        predicate: '"true"',
        badge: { primary_text: 'A', colour: 'gold' },
      }],
    });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'unknown_colour_token')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// row_style_missing_label
// ---------------------------------------------------------------------------

describe('row_style_missing_label', () => {
  it('row style without label → error', async () => {
    const root = makeRoot({
      scoreboards: [{
        name: 'SB',
        scope: 'event',
        primary: true,
        rank_by: { primary: { expr: 'unit.score', direction: 'descending' } },
        columns: [],
        row_styles: [{ predicate: '"true"', label: '', accent: 'gold' }],
      }],
    });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'row_style_missing_label')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// elimination_bracket_removed
// ---------------------------------------------------------------------------

describe('elimination_bracket_removed', () => {
  it('aggregation_function.fn: elimination_bracket → error', async () => {
    const root = makeRoot({
      aggregation_function: { fn: 'elimination_bracket' } as unknown as ReturnType<typeof makeRoot>['aggregation_function'],
    });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'elimination_bracket_removed')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// compile_time_expr_invalid
// ---------------------------------------------------------------------------

describe('compile_time_expr_invalid', () => {
  it('seed pattern with unresolved ${unit.score} → error', async () => {
    const root = makeRoot({
      slots: [{ seed_pattern: '${unit.score}', slot_index: 1 }],
    });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'compile_time_expr_invalid')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// incompatible_routing_branches
// ---------------------------------------------------------------------------

describe('incompatible_routing_branches', () => {
  it('when: proceeds_to, otherwise: assigned_rank → error', async () => {
    const root = makeRoot({
      routing: {
        rank_1: {
          when: '"true"',
          proceeds_to: 'SomeSection',
          otherwise: { assigned_rank: 2 },
        },
      },
    });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'incompatible_routing_branches')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// invalid_material_icon (with mocked fetch)
// ---------------------------------------------------------------------------

describe('invalid_material_icon', () => {
  it('unknown icon with available API → error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => 'home 1234\nstar 5678\n',
    } as Response);

    const root = makeRoot({
      awards: [{
        name: 'Test',
        predicate: '"true"',
        badge: { primary_text: 'A', colour: 'gold', icon: 'nonexistent_xyz_999' },
      }],
    });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'invalid_material_icon' && d.severity === 'error')).toBe(true);
  });

  it('unknown icon with unavailable API → warning not error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    const root = makeRoot({
      awards: [{
        name: 'Test',
        predicate: '"true"',
        badge: { primary_text: 'A', colour: 'gold', icon: 'nonexistent_xyz_999' },
      }],
    });
    const diags = await validateExpanded(makeConfig(root));
    expect(diags.some((d) => d.code === 'invalid_material_icon' && d.severity === 'warning')).toBe(true);
    expect(diags.some((d) => d.code === 'invalid_material_icon' && d.severity === 'error')).toBe(false);
  });
});
