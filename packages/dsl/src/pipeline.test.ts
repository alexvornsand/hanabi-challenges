import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { runPipeline, formatYaml, serialiseConfig } from './pipeline.js';
import { parseConfig } from './parser.js';
import { resolveConfig } from './resolver.js';
import { expandConfig } from './expander.js';
import { _resetIconCache } from './lib/materialIcons.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): string {
  return readFileSync(join(__dirname, '__fixtures__', name), 'utf-8');
}

afterEach(() => {
  _resetIconCache();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// runPipeline
// ---------------------------------------------------------------------------

describe('runPipeline — NVC fixture', () => {
  it('canSave: true, warnings but no errors', async () => {
    const result = await runPipeline(loadFixture('nvc.yaml'), new Map());
    expect(result.canSave).toBe(true);
    expect(result.hasErrors).toBe(false);
    expect(result.hasWarnings).toBe(true); // missing_event_id + multi_reg_no_team_id
    expect(result.parseResult).toBeDefined();
    expect(result.expandedConfig).toBeDefined();
  }, 15_000);
});

describe('runPipeline — Boom and Bloom fixture', () => {
  it('canSave: true, one admin_input_required notice', async () => {
    const result = await runPipeline(loadFixture('boom-and-bloom.yaml'), new Map());
    expect(result.canSave).toBe(true);
    expect(result.hasErrors).toBe(false);
    const notices = result.diagnostics.filter(
      (d) => d.code === 'admin_input_required' && d.severity === 'notice',
    );
    expect(notices.length).toBeGreaterThanOrEqual(1);
  }, 15_000);
});

describe('runPipeline — validation error halts pipeline', () => {
  it('YAML with aggregation_function on slot → canSave: false', async () => {
    const yaml = `
event:
  name: Test
  slug: test
  sections:
    - name: Main
      slots:
        - seed_pattern: 'X1'
          aggregation_function:
            reduce: sum
`;
    const result = await runPipeline(yaml, new Map());
    expect(result.canSave).toBe(false);
    expect(result.hasErrors).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'aggregation_on_slot')).toBe(true);
  }, 15_000);
});

describe('runPipeline — parse error halts pipeline', () => {
  it('invalid YAML → resolvedConfig absent', async () => {
    const result = await runPipeline('event: [invalid', new Map());
    expect(result.canSave).toBe(false);
    expect(result.parseResult).toBeUndefined();
    expect(result.resolvedConfig).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// formatYaml
// ---------------------------------------------------------------------------

describe('formatYaml', () => {
  it('reformats YAML with 2-space indentation', () => {
    const yaml = 'event:\n  name: Test\n  slug: test\n';
    const formatted = formatYaml(yaml);
    expect(formatted).toContain('event:');
    expect(formatted).toContain('name: Test');
  });

  it('returns original string on parse error', () => {
    const bad = '[invalid yaml';
    const result = formatYaml(bad);
    expect(result).toBe(bad);
  });
});

// ---------------------------------------------------------------------------
// serialiseConfig — round-trip
// ---------------------------------------------------------------------------

describe('serialiseConfig', () => {
  it('omits non_participant_result: "0"', () => {
    const parsed = parseConfig(loadFixture('nvc.yaml'));
    if (!parsed.ok) throw new Error('parse failed');
    const resolved = resolveConfig(parsed);
    const expanded = expandConfig(resolved, new Map());
    const serialised = serialiseConfig(expanded);
    expect(serialised).not.toContain('"0"');
  });

  it('round-trip for NVC: re-parse produces identical section names', () => {
    const yaml = loadFixture('nvc.yaml');
    const parsed = parseConfig(yaml);
    if (!parsed.ok) throw new Error('parse failed');
    const resolved = resolveConfig(parsed);
    const expanded = expandConfig(resolved, new Map());

    const serialised = serialiseConfig(expanded);
    const reparsed = parseConfig(serialised);
    if (!reparsed.ok) throw new Error(`re-parse failed: ${JSON.stringify(reparsed.diagnostics)}`);
    const reresolved = resolveConfig(reparsed);
    const reexpanded = expandConfig(reresolved, new Map());

    // Section names should match
    const origSections = expanded.root.sections.map((s) => s.name);
    const newSections = reexpanded.root.sections.map((s) => s.name);
    expect(newSections).toEqual(origSections);
  });

  it('round-trip omits matchmaking: {type: none}', () => {
    const parsed = parseConfig(loadFixture('nvc.yaml'));
    if (!parsed.ok) throw new Error('parse failed');
    const resolved = resolveConfig(parsed);
    const expanded = expandConfig(resolved, new Map());
    const serialised = serialiseConfig(expanded);
    // Default matchmaking should not appear
    expect(serialised).not.toContain('type: none');
  });

  it('NVC serialised output contains section slots', () => {
    const parsed = parseConfig(loadFixture('nvc.yaml'));
    if (!parsed.ok) throw new Error('parse failed');
    const resolved = resolveConfig(parsed);
    const expanded = expandConfig(resolved, new Map());
    const serialised = serialiseConfig(expanded);
    expect(serialised).toContain('seed_pattern');
  });
});
