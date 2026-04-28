import { describe, it, expect } from 'vitest';
import { generateSpecs, checkConflicts, validatePattern } from './seedEngine.js';

describe('generateSpecs', () => {
  it('{eventID}w1-g{slotIndex*} with eventID=42, slotIndex=5 → ["e42w1-g5"]', () => {
    const result = generateSpecs('{eventID}w1-g{slotIndex*}', { eventID: 42, slotIndex: 5 });
    expect(result).toEqual(['e42w1-g5']);
  });

  it('generates prefixed form: {eventID} → e42', () => {
    const result = generateSpecs('{eventID}', { eventID: 42 });
    expect(result).toEqual(['e42']);
  });

  it('generates bare form: {eventID*} → 42', () => {
    const result = generateSpecs('{eventID*}', { eventID: 42 });
    expect(result).toEqual(['42']);
  });

  it('generates full spec: {eventID}{sectionID}{slotIndex}', () => {
    const result = generateSpecs('{eventID}{sectionID}{slotIndex}', {
      eventID: 1,
      sectionID: 2,
      slotIndex: 3,
    });
    expect(result).toEqual(['e1s2g3']);
  });

  it('literal-only pattern passes through', () => {
    const result = generateSpecs('NVC1', {});
    expect(result).toEqual(['NVC1']);
  });

  it('teamID prefixed and attemptID prefixed', () => {
    const result = generateSpecs('{teamID}{attemptID}', { teamID: 10, attemptID: 3 });
    expect(result).toEqual(['t10a3']);
  });

  it('teamID prefixed and attemptID bare', () => {
    const result = generateSpecs('{teamID}{attemptID*}', { teamID: 10, attemptID: 3 });
    expect(result).toEqual(['t103']);
  });
});

describe('checkConflicts', () => {
  it('spec in registry → one conflict', () => {
    const conflicts = checkConflicts(['e42w1-g5'], new Set(['e42w1-g5']));
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.spec).toBe('e42w1-g5');
  });

  it('no conflict when spec not in registry', () => {
    const conflicts = checkConflicts(['e42w1-g5'], new Set(['e42w1-g6']));
    expect(conflicts).toHaveLength(0);
  });

  it('duplicate specs in input → conflict', () => {
    const conflicts = checkConflicts(['e1g1', 'e1g1'], new Set());
    expect(conflicts).toHaveLength(1);
  });

  it('empty input → no conflicts', () => {
    expect(checkConflicts([], new Set())).toHaveLength(0);
  });
});

describe('validatePattern', () => {
  it('attempt modifier enabled, no attemptID → attempt_id_missing error', () => {
    const diags = validatePattern('{teamID}', {
      hasAttemptModifier: true,
      hasMultiRegistration: false,
    });
    const codes = diags.map((d) => d.code);
    expect(codes).toContain('attempt_id_missing');
  });

  it('multi-registration enabled, no teamID → team_id_missing error', () => {
    const diags = validatePattern('{eventID}{slotIndex}', {
      hasAttemptModifier: false,
      hasMultiRegistration: true,
    });
    const codes = diags.map((d) => d.code);
    expect(codes).toContain('team_id_missing');
  });

  it('adjacent bare variables → warning', () => {
    const diags = validatePattern('{eventID*}{slotIndex*}', {
      hasAttemptModifier: false,
      hasMultiRegistration: false,
    });
    const codes = diags.map((d) => d.code);
    expect(codes).toContain('adjacent_bare_variables');
  });

  it('no eventID → warning', () => {
    const diags = validatePattern('{slotIndex}', {
      hasAttemptModifier: false,
      hasMultiRegistration: false,
    });
    const codes = diags.map((d) => d.code);
    expect(codes).toContain('missing_event_id');
  });

  it('valid pattern → no errors', () => {
    const diags = validatePattern('{eventID}{sectionID}{slotIndex}', {
      hasAttemptModifier: false,
      hasMultiRegistration: false,
    });
    const errors = diags.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('valid pattern with attempt modifier → no errors', () => {
    const diags = validatePattern('{eventID}{slotIndex}{attemptID}', {
      hasAttemptModifier: true,
      hasMultiRegistration: false,
    });
    const errors = diags.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});
