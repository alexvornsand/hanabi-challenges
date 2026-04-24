import { describe, it, expect } from 'vitest';
import { parseExpr } from './parser.js';

describe('parseExpr — basic nodes', () => {
  it('game.points → path', () => {
    const result = parseExpr('game.points');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node).toEqual({ kind: 'path', parts: ['game', 'points'] });
    }
  });

  it('unit.score >= 90 → binary >=', () => {
    const result = parseExpr('unit.score >= 90');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.kind).toBe('binary');
      if (result.node.kind === 'binary') {
        expect(result.node.op).toBe('>=');
        expect(result.node.left).toEqual({ kind: 'path', parts: ['unit', 'score'] });
        expect(result.node.right).toEqual({ kind: 'literal', value: 90 });
      }
    }
  });

  it('unit.slot_results.map(sr => sr.games[0].points).avg() → method chain', () => {
    const result = parseExpr('unit.slot_results.map(sr => sr.games[0].points).avg()');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.kind).toBe('method');
      if (result.node.kind === 'method') {
        expect(result.node.method).toBe('avg');
      }
    }
  });

  it('a.participants == b.participants → binary ==', () => {
    const result = parseExpr('a.participants == b.participants');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.kind).toBe('binary');
      if (result.node.kind === 'binary') {
        expect(result.node.op).toBe('==');
      }
    }
  });

  it('expr ?? default → nullCoalesce', () => {
    const result = parseExpr('x ?? 0');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.kind).toBe('nullCoalesce');
    }
  });

  it('cond ? a : b → ternary', () => {
    const result = parseExpr('cond ? a : b');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.kind).toBe('ternary');
    }
  });

  it('x in list → membership', () => {
    const result = parseExpr('x in list');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.kind).toBe('membership');
    }
  });

  it('invalid expression → ok: false', () => {
    // Empty string is invalid
    const result = parseExpr('');
    expect(result.ok).toBe(false);
  });
});

describe('parseExpr — advanced', () => {
  it('null coalesce with path → nullCoalesce', () => {
    const result = parseExpr('unit.advancement_round ?? -1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.kind).toBe('nullCoalesce');
    }
  });

  it('and / or → binary', () => {
    const result = parseExpr('a and b or c');
    expect(result.ok).toBe(true);
  });

  it('event["slug"] → crossEvent', () => {
    const result = parseExpr('event["nvc"]');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.kind).toBe('crossEvent');
      if (result.node.kind === 'crossEvent') {
        expect(result.node.slug).toBe('nvc');
      }
    }
  });

  it('section["name"] → sectionRef', () => {
    const result = parseExpr('section["Week 1"]');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.kind).toBe('sectionRef');
      if (result.node.kind === 'sectionRef') {
        expect(result.node.name).toBe('Week 1');
      }
    }
  });

  it('lambda x => x + 1', () => {
    const result = parseExpr('x => x + 1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.kind).toBe('lambda');
    }
  });

  it('optional chaining ?.', () => {
    const result = parseExpr('unit?.score');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.kind).toBe('optChain');
    }
  });

  it('function call now()', () => {
    const result = parseExpr('now()');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.kind).toBe('call');
      if (result.node.kind === 'call') {
        expect(result.node.name).toBe('now');
      }
    }
  });

  it('index access game.tags[0]', () => {
    const result = parseExpr('game.tags[0]');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.node.kind).toBe('index');
    }
  });
});
