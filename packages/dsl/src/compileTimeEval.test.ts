import { describe, it, expect } from 'vitest';
import { evaluateCompileTime, interpolate } from './compileTimeEval.js';

describe('evaluateCompileTime', () => {
  it('ceil(match / 2) with match=3 → 2', () => {
    const result = evaluateCompileTime('ceil(match / 2)', { match: 3 });
    expect(result).toEqual({ ok: true, value: 2 });
  });

  it('basic arithmetic', () => {
    expect(evaluateCompileTime('2 + 3 * 4', {})).toEqual({ ok: true, value: 14 });
  });

  it('pow(2, 8) → 256', () => {
    expect(evaluateCompileTime('pow(2, 8)', {})).toEqual({ ok: true, value: 256 });
  });

  it('floor(7 / 2) → 3', () => {
    expect(evaluateCompileTime('floor(7 / 2)', {})).toEqual({ ok: true, value: 3 });
  });

  it('abs(-5) → 5', () => {
    expect(evaluateCompileTime('abs(-5)', {})).toEqual({ ok: true, value: 5 });
  });

  it('variable reference from env', () => {
    expect(evaluateCompileTime('round + 1', { round: 2 })).toEqual({ ok: true, value: 3 });
  });

  it('comparison operators', () => {
    expect(evaluateCompileTime('3 > 2', {})).toEqual({ ok: true, value: true });
    expect(evaluateCompileTime('3 == 3', {})).toEqual({ ok: true, value: true });
    expect(evaluateCompileTime('3 != 4', {})).toEqual({ ok: true, value: true });
  });

  it('unit.score (path access) → error', () => {
    const result = evaluateCompileTime('unit.score', {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('compile_time_expr_invalid');
    }
  });

  it('unknown identifier not in env → error', () => {
    const result = evaluateCompileTime('unknownVar', {});
    expect(result.ok).toBe(false);
  });

  it('now() → error', () => {
    const result = evaluateCompileTime('now()', {});
    expect(result.ok).toBe(false);
  });
});

describe('interpolate', () => {
  it('R${round + 1}-M${ceil(match / 2)} → "R3-M2"', () => {
    const result = interpolate('R${round + 1}-M${ceil(match / 2)}', { round: 2, match: 3 });
    expect(result).toEqual({ ok: true, value: 'R3-M2' });
  });

  it('$name slot → "Week slot"', () => {
    const result = interpolate('$name slot', { name: 'Week' });
    expect(result).toEqual({ ok: true, value: 'Week slot' });
  });

  it('${unit.score} → error', () => {
    const result = interpolate('${unit.score}', {});
    expect(result.ok).toBe(false);
  });

  it('literal string with no substitutions', () => {
    const result = interpolate('hello world', {});
    expect(result).toEqual({ ok: true, value: 'hello world' });
  });

  it('multiple $name substitutions', () => {
    const result = interpolate('$a-$b', { a: 'foo', b: 'bar' });
    expect(result).toEqual({ ok: true, value: 'foo-bar' });
  });
});
