import type { ExprNode, BinaryOp } from '../types.js';

export interface ExprParseSuccess {
  ok: true;
  node: ExprNode;
}
export interface ExprParseError {
  ok: false;
  message: string;
  expr: string;
}
export type ExprParseOutcome = ExprParseSuccess | ExprParseError;

// ---------------------------------------------------------------------------
// Tokeniser
// ---------------------------------------------------------------------------

type Token =
  | { type: 'number'; value: number; pos: number }
  | { type: 'string'; value: string; pos: number }
  | { type: 'bool'; value: boolean; pos: number }
  | { type: 'null'; pos: number }
  | { type: 'ident'; value: string; pos: number }
  | { type: 'op'; value: string; pos: number }
  | { type: 'lparen'; pos: number }
  | { type: 'rparen'; pos: number }
  | { type: 'lbracket'; pos: number }
  | { type: 'rbracket'; pos: number }
  | { type: 'comma'; pos: number }
  | { type: 'dot'; pos: number }
  | { type: 'optchain'; pos: number }   // ?.
  | { type: 'arrow'; pos: number }      // =>
  | { type: 'ternary_q'; pos: number }  // ?
  | { type: 'ternary_c'; pos: number }  // :
  | { type: 'eof'; pos: number };

function tokenise(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch)) { i++; continue; }
    const pos = i;

    // Numbers
    if (/[0-9]/.test(ch)) {
      let num = '';
      while (i < src.length && /[0-9.eE+\-]/.test(src[i]!)) num += src[i++]!;
      tokens.push({ type: 'number', value: parseFloat(num), pos });
      continue;
    }

    // Strings
    if (ch === '"' || ch === "'") {
      const quote = src[i++]!;
      let str = '';
      while (i < src.length && src[i]! !== quote) {
        if (src[i]! === '\\') { i++; str += src[i++]!; }
        else str += src[i++]!;
      }
      i++;
      tokens.push({ type: 'string', value: str, pos });
      continue;
    }

    // Identifiers / keywords
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < src.length && /[a-zA-Z_0-9]/.test(src[i]!)) ident += src[i++]!;
      if (ident === 'true') tokens.push({ type: 'bool', value: true, pos });
      else if (ident === 'false') tokens.push({ type: 'bool', value: false, pos });
      else if (ident === 'null') tokens.push({ type: 'null', pos });
      else tokens.push({ type: 'ident', value: ident, pos });
      continue;
    }

    // Two-char sequences
    const two = src.slice(i, i + 2);
    if (two === '=>') { tokens.push({ type: 'arrow', pos }); i += 2; continue; }
    if (two === '?.') { tokens.push({ type: 'optchain', pos }); i += 2; continue; }
    if (two === '??') { tokens.push({ type: 'op', value: '??', pos }); i += 2; continue; }
    if (two === '==') { tokens.push({ type: 'op', value: '==', pos }); i += 2; continue; }
    if (two === '!=') { tokens.push({ type: 'op', value: '!=', pos }); i += 2; continue; }
    if (two === '<=') { tokens.push({ type: 'op', value: '<=', pos }); i += 2; continue; }
    if (two === '>=') { tokens.push({ type: 'op', value: '>=', pos }); i += 2; continue; }

    // Single-char
    switch (ch) {
      case '(': tokens.push({ type: 'lparen', pos }); i++; continue;
      case ')': tokens.push({ type: 'rparen', pos }); i++; continue;
      case '[': tokens.push({ type: 'lbracket', pos }); i++; continue;
      case ']': tokens.push({ type: 'rbracket', pos }); i++; continue;
      case ',': tokens.push({ type: 'comma', pos }); i++; continue;
      case '.': tokens.push({ type: 'dot', pos }); i++; continue;
      case '?': tokens.push({ type: 'ternary_q', pos }); i++; continue;
      case ':': tokens.push({ type: 'ternary_c', pos }); i++; continue;
      case '+': tokens.push({ type: 'op', value: '+', pos }); i++; continue;
      case '-': tokens.push({ type: 'op', value: '-', pos }); i++; continue;
      case '*': tokens.push({ type: 'op', value: '*', pos }); i++; continue;
      case '/': tokens.push({ type: 'op', value: '/', pos }); i++; continue;
      case '%': tokens.push({ type: 'op', value: '%', pos }); i++; continue;
      case '<': tokens.push({ type: 'op', value: '<', pos }); i++; continue;
      case '>': tokens.push({ type: 'op', value: '>', pos }); i++; continue;
      case '!': tokens.push({ type: 'op', value: '!', pos }); i++; continue;
    }
    i++;
  }

  tokens.push({ type: 'eof', pos: i });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser state helpers
// ---------------------------------------------------------------------------

interface PS { tokens: Token[]; pos: number; src: string }

function peek(s: PS): Token { return s.tokens[s.pos] ?? { type: 'eof', pos: s.src.length }; }
function consume(s: PS): Token { return s.tokens[s.pos++] ?? { type: 'eof', pos: s.src.length }; }
function check(s: PS, type: Token['type']): boolean { return peek(s).type === type; }
function checkOp(s: PS, value: string): boolean { const t = peek(s); return t.type === 'op' && (t as {value: string}).value === value; }
function checkIdent(s: PS, value: string): boolean { const t = peek(s); return t.type === 'ident' && (t as {value: string}).value === value; }

// ---------------------------------------------------------------------------
// Grammar (lowest to highest precedence)
// ---------------------------------------------------------------------------

function pNullCoalesce(s: PS): ExprNode {
  let left = pOr(s);
  while (checkOp(s, '??')) {
    consume(s);
    const right = pOr(s);
    left = { kind: 'nullCoalesce', left, right };
  }
  return left;
}

function pOr(s: PS): ExprNode {
  let left = pAnd(s);
  while (checkIdent(s, 'or')) {
    consume(s);
    const right = pAnd(s);
    left = { kind: 'binary', op: 'or', left, right };
  }
  return left;
}

function pAnd(s: PS): ExprNode {
  let left = pNot(s);
  while (checkIdent(s, 'and')) {
    consume(s);
    const right = pNot(s);
    left = { kind: 'binary', op: 'and', left, right };
  }
  return left;
}

function pNot(s: PS): ExprNode {
  if (checkIdent(s, 'not')) {
    consume(s);
    return { kind: 'unary', op: 'not', operand: pNot(s) };
  }
  return pComparison(s);
}

function pComparison(s: PS): ExprNode {
  let left = pAddSub(s);
  const t = peek(s);
  if (t.type === 'op' && ['==', '!=', '<', '<=', '>', '>='].includes((t as {value: string}).value)) {
    consume(s);
    const right = pAddSub(s);
    left = { kind: 'binary', op: (t as {value: string}).value as BinaryOp, left, right };
  } else if (checkIdent(s, 'in')) {
    consume(s);
    const list = pAddSub(s);
    left = { kind: 'membership', item: left, list };
  }
  return left;
}

function pAddSub(s: PS): ExprNode {
  let left = pMulDiv(s);
  while (true) {
    const t = peek(s);
    if (t.type === 'op' && ((t as {value: string}).value === '+' || (t as {value: string}).value === '-')) {
      consume(s);
      const right = pMulDiv(s);
      left = { kind: 'binary', op: (t as {value: string}).value as BinaryOp, left, right };
    } else break;
  }
  return left;
}

function pMulDiv(s: PS): ExprNode {
  let left = pUnary(s);
  while (true) {
    const t = peek(s);
    if (t.type === 'op' && ['*', '/', '%'].includes((t as {value: string}).value)) {
      consume(s);
      const right = pUnary(s);
      left = { kind: 'binary', op: (t as {value: string}).value as BinaryOp, left, right };
    } else break;
  }
  return left;
}

function pUnary(s: PS): ExprNode {
  const t = peek(s);
  if (t.type === 'op' && (t as {value: string}).value === '-') {
    consume(s);
    return { kind: 'unary', op: '-', operand: pUnary(s) };
  }
  if (t.type === 'op' && (t as {value: string}).value === '!') {
    consume(s);
    return { kind: 'unary', op: 'not', operand: pUnary(s) };
  }
  return pTernary(s);
}

function pTernary(s: PS): ExprNode {
  const cond = pPostfix(s);
  if (check(s, 'ternary_q')) {
    consume(s);
    const then = pNullCoalesce(s);
    consume(s); // :
    const els = pTernary(s);
    return { kind: 'ternary', condition: cond, then, else: els };
  }
  return cond;
}

function pPostfix(s: PS): ExprNode {
  let node = pPrimary(s);

  while (true) {
    if (check(s, 'dot')) {
      consume(s);
      const key = consume(s);
      if (key.type !== 'ident') break;
      const keyName = (key as {value: string}).value;

      if (check(s, 'lparen')) {
        // Method call: node.method(args)
        consume(s);
        const args: ExprNode[] = [];
        while (!check(s, 'rparen') && !check(s, 'eof')) {
          args.push(pNullCoalesce(s));
          if (check(s, 'comma')) consume(s);
        }
        consume(s);
        node = { kind: 'method', object: node, method: keyName, args };
      } else {
        // Property access
        if (node.kind === 'path') {
          node = { kind: 'path', parts: [...node.parts, keyName] };
        } else {
          // Chained property on non-path node — use method with no args as accessor
          node = { kind: 'method', object: node, method: keyName, args: [] };
        }
      }
      continue;
    }

    if (check(s, 'optchain')) {
      consume(s);
      const key = consume(s);
      if (key.type !== 'ident') break;
      node = { kind: 'optChain', object: node, key: (key as {value: string}).value };
      continue;
    }

    if (check(s, 'lbracket')) {
      consume(s);
      const keyExpr = pNullCoalesce(s);
      consume(s); // ]
      node = { kind: 'index', object: node, key: keyExpr };
      continue;
    }

    // Standalone function call: name(args)
    if (check(s, 'lparen') && node.kind === 'path' && node.parts.length === 1) {
      consume(s);
      const args: ExprNode[] = [];
      while (!check(s, 'rparen') && !check(s, 'eof')) {
        args.push(pNullCoalesce(s));
        if (check(s, 'comma')) consume(s);
      }
      consume(s);
      node = { kind: 'call', name: node.parts[0]!, args };
      continue;
    }

    break;
  }

  return node;
}

function pPrimary(s: PS): ExprNode {
  const t = peek(s);

  if (t.type === 'lparen') {
    consume(s);
    const inner = pNullCoalesce(s);
    consume(s); // )
    return inner;
  }
  if (t.type === 'number') { consume(s); return { kind: 'literal', value: t.value }; }
  if (t.type === 'string') { consume(s); return { kind: 'literal', value: t.value }; }
  if (t.type === 'bool') { consume(s); return { kind: 'literal', value: t.value }; }
  if (t.type === 'null') { consume(s); return { kind: 'literal', value: null }; }

  if (t.type === 'ident') {
    consume(s);
    const name = t.value;

    // Lambda: ident => expr
    if (check(s, 'arrow')) {
      consume(s);
      const body = pNullCoalesce(s);
      return { kind: 'lambda', param: name, body };
    }

    // section["name"] → sectionRef
    if (name === 'section' && check(s, 'lbracket')) {
      consume(s);
      const keyExpr = pNullCoalesce(s);
      consume(s); // ]
      if (keyExpr.kind === 'literal' && typeof keyExpr.value === 'string') {
        return { kind: 'sectionRef', name: keyExpr.value };
      }
      return { kind: 'index', object: { kind: 'path', parts: ['section'] }, key: keyExpr };
    }

    // event["slug"] → crossEvent
    if (name === 'event' && check(s, 'lbracket')) {
      consume(s);
      const keyExpr = pNullCoalesce(s);
      consume(s); // ]
      if (keyExpr.kind === 'literal' && typeof keyExpr.value === 'string') {
        return { kind: 'crossEvent', slug: keyExpr.value, rest: null };
      }
      return { kind: 'index', object: { kind: 'path', parts: ['event'] }, key: keyExpr };
    }

    return { kind: 'path', parts: [name] };
  }

  // Unknown token — consume and return null literal
  consume(s);
  return { kind: 'literal', value: null };
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export function parseExpr(expr: string): ExprParseOutcome {
  try {
    const tokens = tokenise(expr.trim());
    const s: PS = { tokens, pos: 0, src: expr };

    if (tokens.length === 1 && tokens[0]!.type === 'eof') {
      return { ok: false, message: 'Empty expression', expr };
    }

    const node = pNullCoalesce(s);

    if (!check(s, 'eof')) {
      return { ok: false, message: `Unexpected token at position ${peek(s).pos}`, expr };
    }

    return { ok: true, node };
  } catch (e) {
    return { ok: false, message: String(e), expr };
  }
}
