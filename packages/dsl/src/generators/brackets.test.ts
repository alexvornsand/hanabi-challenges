import { describe, it, expect } from 'vitest';
import { singleElimination, doubleElimination, stepladder, roundRobin } from './brackets.js';
import type { BracketParams } from './brackets.js';
import type { ExpandedSection } from '../types.js';

const PARAMS: BracketParams = {
  match_comparators: [{ expr: 'game.points', direction: 'higher' }],
  slots: 1,
  assignment: 'dynamic',
};

// Helper: collect all leaf matchup section names recursively
function collectNames(sections: ExpandedSection[]): string[] {
  const names: string[] = [];
  for (const s of sections) {
    names.push(s.name);
    names.push(...collectNames(s.sections));
  }
  return names;
}

// Helper: collect all routing proceeds_to / assigned_to targets
function collectRoutingTargets(sections: ExpandedSection[]): string[] {
  const targets: string[] = [];
  for (const s of sections) {
    if (s.routing) {
      for (const rule of Object.values(s.routing)) {
        if (rule && typeof rule === 'object' && 'proceeds_to' in rule) {
          targets.push((rule as { proceeds_to: string }).proceeds_to);
        }
      }
    }
    targets.push(...collectRoutingTargets(s.sections));
  }
  return targets;
}

describe('singleElimination', () => {
  it('8 units → 7 matchup sections across 3 rounds', () => {
    const sections = singleElimination(PARAMS, 8);
    expect(sections).toHaveLength(7);
    // Round 1: R1-M1..M4
    const r1 = sections.filter((s) => s.name.startsWith('R1-'));
    expect(r1).toHaveLength(4);
    // Round 2: R2-M1..M2
    const r2 = sections.filter((s) => s.name.startsWith('R2-'));
    expect(r2).toHaveLength(2);
    // Round 3: R3-M1 (final)
    const r3 = sections.filter((s) => s.name.startsWith('R3-'));
    expect(r3).toHaveLength(1);
  });

  it('final section has assigned_rank routing', () => {
    const sections = singleElimination(PARAMS, 8);
    const final = sections.find((s) => s.name === 'R3-M1')!;
    expect(final).toBeDefined();
    expect(final.routing?.rank_1).toEqual({ assigned_rank: 1 });
    expect(final.routing?.rank_2).toEqual({ assigned_rank: 2 });
  });

  it('non-final sections have proceeds_to routing', () => {
    const sections = singleElimination(PARAMS, 8);
    const r1m1 = sections.find((s) => s.name === 'R1-M1')!;
    expect(r1m1.routing?.rank_1).toEqual({ proceeds_to: 'R2-M1' });
    expect(r1m1.routing?.rank_2).toEqual({ eliminated: true });
    // R1-M2 also proceeds to R2-M1 (ceil(2/2)=1)
    const r1m2 = sections.find((s) => s.name === 'R1-M2')!;
    expect(r1m2.routing?.rank_1).toEqual({ proceeds_to: 'R2-M1' });
    // R1-M3 proceeds to R2-M2 (ceil(3/2)=2)
    const r1m3 = sections.find((s) => s.name === 'R1-M3')!;
    expect(r1m3.routing?.rank_1).toEqual({ proceeds_to: 'R2-M2' });
  });

  it('all routing targets resolve (no unresolved_reference)', () => {
    const sections = singleElimination(PARAMS, 8);
    const names = new Set(collectNames(sections));
    const targets = collectRoutingTargets(sections);
    for (const t of targets) {
      expect(names.has(t), `routing target "${t}" not found in section names`).toBe(true);
    }
  });

  it('uses match_aggregate aggregation_function', () => {
    const sections = singleElimination(PARAMS, 8);
    for (const s of sections) {
      expect(s.aggregation_function).toMatchObject({ fn: 'match_aggregate' });
    }
  });
});

describe('roundRobin', () => {
  it('4 units → 6 matchup sections + 1 standings section', () => {
    const sections = roundRobin(PARAMS, 4);
    const matchups = sections.filter((s) => s.name.startsWith('RR-M'));
    const standings = sections.filter((s) => s.name === 'RR-Standings');
    expect(matchups).toHaveLength(6);
    expect(standings).toHaveLength(1);
    expect(sections).toHaveLength(7);
  });

  it('all routing targets resolve', () => {
    const sections = roundRobin(PARAMS, 4);
    const names = new Set(collectNames(sections));
    const targets = collectRoutingTargets(sections);
    for (const t of targets) {
      expect(names.has(t), `routing target "${t}" not found`).toBe(true);
    }
  });
});

describe('DeferredSlotCount', () => {
  it('slots: string expression → deferred_slot_count on all matchup sections', () => {
    const params: BracketParams = { ...PARAMS, slots: 'round == 1 ? 2 : 1' };
    const sections = singleElimination(params, 8);
    for (const s of sections) {
      expect(s.deferred_slot_count).toBeDefined();
      expect(s.deferred_slot_count?.kind).toBe('deferred_count');
      expect(s.deferred_slot_count?.expr).toBe('round == 1 ? 2 : 1');
      expect(s.slots).toHaveLength(0);
    }
  });

  it('slots: number → no deferred_slot_count, explicit slots array', () => {
    const sections = singleElimination({ ...PARAMS, slots: 2 }, 4);
    for (const s of sections) {
      expect(s.deferred_slot_count).toBeUndefined();
      expect(s.slots.length).toBeGreaterThan(0);
    }
  });
});

describe('stepladder', () => {
  it('4 units → 3 step sections', () => {
    const sections = stepladder(PARAMS, 4);
    expect(sections).toHaveLength(3);
    expect(sections[0]!.name).toBe('Step1');
    expect(sections[2]!.name).toBe('Step3');
  });

  it('final step has assigned_rank routing', () => {
    const sections = stepladder(PARAMS, 4);
    const final = sections[sections.length - 1]!;
    expect(final.routing?.rank_1).toEqual({ assigned_rank: 1 });
  });
});
