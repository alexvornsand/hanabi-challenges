import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseConfig } from './parser.js';
import { resolveConfig } from './resolver.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): string {
  return readFileSync(join(__dirname, '__fixtures__', name), 'utf-8');
}

function parseAndResolve(yaml: string) {
  const parseResult = parseConfig(yaml);
  if (!parseResult.ok) throw new Error(`Parse failed: ${JSON.stringify(parseResult.diagnostics)}`);
  return resolveConfig(parseResult);
}

describe('resolveConfig — inheritance', () => {
  it('section without capture_policy inherits from parent', () => {
    const resolved = parseAndResolve(`
event:
  name: Test
  slug: test
  capture_policy:
    scrape: true
  sections:
    - name: Child
`);
    const child = resolved.resolved.sections?.[0];
    expect(child).toBeDefined();
    if (child && 'capture_policy' in child) {
      expect((child as { capture_policy: unknown }).capture_policy).toEqual({ scrape: true });
    }
  });

  it('root scoring_unit_type: team propagates to child; child individual overrides', () => {
    const resolved = parseAndResolve(`
event:
  name: Test
  slug: test
  scoring_unit_type: team
  sections:
    - name: Inherited
    - name: Overridden
      scoring_unit_type: individual
`);
    const sections = resolved.resolved.sections ?? [];
    expect(sections.length).toBe(2);
    const inherited = sections[0] as { scoring_unit_type?: string };
    const overridden = sections[1] as { scoring_unit_type?: string };
    expect(inherited.scoring_unit_type).toBe('team');
    expect(overridden.scoring_unit_type).toBe('individual');
  });

  it('derived_ranking section gets non_participant_result: "unit.parent_score"', () => {
    const resolved = parseAndResolve(`
event:
  name: Test
  slug: test
  sections:
    - name: DerivedSection
      aggregation_function:
        fn: derived_ranking
        score: 'unit.score'
`);
    const section = resolved.resolved.sections?.[0] as { non_participant_result?: string };
    expect(section?.non_participant_result).toBe('"unit.parent_score"');
  });

  it('classification_rule on parent does not propagate to child', () => {
    const resolved = parseAndResolve(`
event:
  name: Test
  slug: test
  classification_rule: 'stable_partnership'
  sections:
    - name: Child
`);
    const child = resolved.resolved.sections?.[0] as { classification_rule?: string };
    expect(child?.classification_rule).toBeUndefined();
  });

  it('all three fixtures resolve without diagnostics', () => {
    for (const fixture of ['nvc.yaml', 'gauntlet.yaml', 'boom-and-bloom.yaml']) {
      const yaml = loadFixture(fixture);
      const parseResult = parseConfig(yaml);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) continue;
      const resolved = resolveConfig(parseResult);
      expect(resolved.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    }
  });
});

describe('resolveConfig — defaults', () => {
  it('root gets default capture_policy when not set', () => {
    const resolved = parseAndResolve(`
event:
  name: Test
  slug: test
`);
    expect(resolved.resolved.capture_policy).toEqual({ scrape: false, submit: true });
  });

  it('root gets default visibility_policy when not set', () => {
    const resolved = parseAndResolve(`
event:
  name: Test
  slug: test
`);
    expect(resolved.resolved.visibility_policy).toEqual({
      results_visible: '"true"',
      specs_visible: '"true"',
    });
  });

  it('root gets default scoring_unit_type: individual', () => {
    const resolved = parseAndResolve(`
event:
  name: Test
  slug: test
`);
    expect(resolved.resolved.scoring_unit_type).toBe('individual');
  });
});
