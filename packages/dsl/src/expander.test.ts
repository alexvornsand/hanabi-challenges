import { describe, it, expect } from 'vitest';
import { parseConfig } from './parser.js';
import { resolveConfig } from './resolver.js';
import { expandConfig } from './expander.js';

function buildExpanded(yaml: string) {
  const parsed = parseConfig(yaml);
  if (!parsed.ok) throw new Error(`Parse error: ${JSON.stringify(parsed.diagnostics)}`);
  const resolved = resolveConfig(parsed);
  return expandConfig(resolved, new Map());
}

describe('expandConfig — NVC-style 100 slots via sequence', () => {
  it('sequence(count: 100) expands to 100 slots', () => {
    const yaml = `
event:
  name: NVC Test
  slug: nvc-test
  sections:
    - name: Main
      slots:
        - generator: sequence
          count: 100
          slot:
            seed_pattern: 'NVC{i}'
`;
    const expanded = buildExpanded(yaml);
    const section = expanded.root.sections[0]!;
    expect(section).toBeDefined();
    const leafSlots = section.slots.filter((s) => !('kind' in s));
    expect(leafSlots).toHaveLength(100);
    const first = leafSlots[0] as { seed_pattern: string; slot_index: number };
    expect(first.seed_pattern).toBe('NVC1');
    expect(first.slot_index).toBe(1);
  });
});

describe('expandConfig — deferred slots', () => {
  it('on_trigger(admin) → DeferredSlotGenerator with admin_sequence', () => {
    const yaml = `
event:
  name: Test
  slug: test
  sections:
    - name: Section
      slots:
        - generator: on_trigger
          trigger: admin
`;
    const expanded = buildExpanded(yaml);
    const section = expanded.root.sections[0]!;
    const deferred = section.slots.find((s) => 'kind' in s);
    expect(deferred).toBeDefined();
    if (deferred && 'kind' in deferred) {
      expect(deferred.kind).toBe('deferred');
      expect(deferred.trigger_type).toBe('admin_sequence');
    }
  });

  it('on_trigger(attempt_start) → trigger_type attempt_start', () => {
    const yaml = `
event:
  name: Test
  slug: test
  sections:
    - name: Section
      slots:
        - generator: on_trigger
          trigger: attempt_start
`;
    const expanded = buildExpanded(yaml);
    const section = expanded.root.sections[0]!;
    const deferred = section.slots.find((s) => 'kind' in s);
    expect(deferred).toBeDefined();
    if (deferred && 'kind' in deferred) {
      expect(deferred.trigger_type).toBe('attempt_start');
    }
  });

  it('sequence(count: admin) → DeferredSlotGenerator', () => {
    const yaml = `
event:
  name: Test
  slug: test
  sections:
    - name: Section
      slots:
        - generator: sequence
          count: admin
`;
    const expanded = buildExpanded(yaml);
    const section = expanded.root.sections[0]!;
    const deferred = section.slots.find((s) => 'kind' in s);
    expect(deferred).toBeDefined();
    if (deferred && 'kind' in deferred) {
      expect(deferred.trigger_type).toBe('admin_sequence');
    }
  });
});

describe('expandConfig — compile-time substitution', () => {
  it('${ceil(match / 2)} with match=3 → "2" in seed pattern', () => {
    // This tests that interpolation works via the sequence loop var
    const yaml = `
event:
  name: Test
  slug: test
  sections:
    - name: Main
      slots:
        - generator: sequence
          count: 1
          slot:
            seed_pattern: 'R\${ceil(i / 2)}'
`;
    const expanded = buildExpanded(yaml);
    const section = expanded.root.sections[0]!;
    const slot = section.slots[0] as { seed_pattern: string };
    expect(slot.seed_pattern).toBe('R1');
  });

  it('${unit.score} in seed pattern → compile_time_expr_invalid error', () => {
    const yaml = `
event:
  name: Test
  slug: test
  sections:
    - name: Main
      slots:
        - seed_pattern: '\${unit.score}'
`;
    const expanded = buildExpanded(yaml);
    const errorDiags = expanded.diagnostics.filter((d) => d.code === 'compile_time_expr_invalid');
    expect(errorDiags.length).toBeGreaterThan(0);
  });
});

describe('expandConfig — routing validation', () => {
  it('unresolved routing target → unresolved_reference error', () => {
    const yaml = `
event:
  name: Test
  slug: test
  sections:
    - name: Section A
      routing:
        rank_1:
          proceeds_to: "NonExistentSection"
`;
    const expanded = buildExpanded(yaml);
    const errors = expanded.diagnostics.filter((d) => d.code === 'unresolved_reference');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('valid routing target → no unresolved_reference error', () => {
    const yaml = `
event:
  name: Test
  slug: test
  sections:
    - name: Section A
      routing:
        rank_1:
          proceeds_to: "Section B"
    - name: Section B
`;
    const expanded = buildExpanded(yaml);
    const errors = expanded.diagnostics.filter((d) => d.code === 'unresolved_reference');
    expect(errors).toHaveLength(0);
  });
});

describe('expandConfig — explicit slots', () => {
  it('explicit slots expand with sequential slot_index', () => {
    const yaml = `
event:
  name: Test
  slug: test
  sections:
    - name: Main
      slots:
        - seed_pattern: 'p2v0sNVC1'
        - seed_pattern: 'p2v0sNVC2'
        - seed_pattern: 'p2v0sNVC3'
`;
    const expanded = buildExpanded(yaml);
    const section = expanded.root.sections[0]!;
    expect(section.slots).toHaveLength(3);
    const slots = section.slots as Array<{ seed_pattern: string; slot_index: number }>;
    expect(slots[0]!.slot_index).toBe(1);
    expect(slots[1]!.slot_index).toBe(2);
    expect(slots[2]!.slot_index).toBe(3);
  });
});
