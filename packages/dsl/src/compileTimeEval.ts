export type CompileTimeEnv = Record<string, number | string | boolean>;

export interface CompileTimeResult {
  ok: true;
  value: number | string | boolean;
}
export interface CompileTimeError {
  ok: false;
  code: 'compile_time_expr_invalid';
  message: string;
  expr: string;
}
export type CompileTimeOutcome = CompileTimeResult | CompileTimeError;

// ---------------------------------------------------------------------------
// Tokeniser
// ---------------------------------------------------------------------------

type Token =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'bool'; value: boolean }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: string }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' }
  | { type: 'eof' };

function tokenise(src: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    // Skip whitespace
    if (/\s/.test(ch)) { i++; continue; }

    // Number
    if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let num = '';
      if (src[i]! === '-') num += src[i++]!;
      while (i < src.length && /[0-9.]/.test(src[i]!)) num += src[i++]!;
      tokens.push({ type: 'number', value: parseFloat(num) });
      continue;
    }

    // String literal
    if (ch === '"' || ch === "'") {
      const quote = src[i++]!;
      let str = '';
      while (i < src.length && src[i]! !== quote) str += src[i++]!;
      i++; // closing quote
      tokens.push({ type: 'string', value: str });
      continue;
    }

    // Identifier / keyword
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < src.length && /[a-zA-Z_0-9]/.test(src[i]!)) ident += src[i++]!;
      if (ident === 'true') tokens.push({ type: 'bool', value: true });
      else if (ident === 'false') tokens.push({ type: 'bool', value: false });
      else tokens.push({ type: 'ident', value: ident });
      continue;
    }

    // Two-char operators
    const twoChar = src.slice(i, i + 2);
    if (['==', '!=', '<=', '>='].includes(twoChar)) {
      tokens.push({ type: 'op', value: twoChar });
      i += 2;
      continue;
    }

    // Single-char operators / punctuation
    if ('+-*/%()<>,'.includes(ch)) {
      if (ch === '(') tokens.push({ type: 'lparen' });
      else if (ch === ')') tokens.push({ type: 'rparen' });
      else if (ch === ',') tokens.push({ type: 'comma' });
      else tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    // Reject dot access and other unknown chars — these are runtime expressions
    return null;
  }
  tokens.push({ type: 'eof' });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser / evaluator (recursive descent, single-pass)
// ---------------------------------------------------------------------------

type ParseState = { tokens: Token[]; pos: number; env: CompileTimeEnv };

function peek(s: ParseState): Token {
  return s.tokens[s.pos] ?? { type: 'eof' };
}
function consume(s: ParseState): Token {
  return s.tokens[s.pos++] ?? { type: 'eof' };
}

function parseExpr(s: ParseState): number | string | boolean | null {
  return parseComparison(s);
}

function parseComparison(s: ParseState): number | string | boolean | null {
  const left = parseAddSub(s);
  if (left === null) return null;
  const op = peek(s);
  if (op.type === 'op' && ['==', '!=', '<', '<=', '>', '>='].includes(op.value)) {
    consume(s);
    const right = parseAddSub(s);
    if (right === null) return null;
    switch (op.value) {
      case '==': return left === right;
      case '!=': return left !== right;
      case '<': return (left as number) < (right as number);
      case '<=': return (left as number) <= (right as number);
      case '>': return (left as number) > (right as number);
      case '>=': return (left as number) >= (right as number);
    }
  }
  return left;
}

function parseAddSub(s: ParseState): number | string | boolean | null {
  let left = parseMulDiv(s);
  if (left === null) return null;
  while (true) {
    const op = peek(s);
    if (op.type !== 'op' || !['+', '-'].includes(op.value)) break;
    consume(s);
    const right = parseMulDiv(s);
    if (right === null) return null;
    if (op.value === '+') left = (left as number) + (right as number);
    else left = (left as number) - (right as number);
  }
  return left;
}

function parseMulDiv(s: ParseState): number | string | boolean | null {
  let left = parseUnary(s);
  if (left === null) return null;
  while (true) {
    const op = peek(s);
    if (op.type !== 'op' || !['*', '/', '%'].includes(op.value)) break;
    consume(s);
    const right = parseUnary(s);
    if (right === null) return null;
    if (op.value === '*') left = (left as number) * (right as number);
    else if (op.value === '/') left = (left as number) / (right as number);
    else left = (left as number) % (right as number);
  }
  return left;
}

function parseUnary(s: ParseState): number | string | boolean | null {
  const op = peek(s);
  if (op.type === 'op' && op.value === '-') {
    consume(s);
    const val = parseUnary(s);
    if (val === null) return null;
    return -(val as number);
  }
  return parsePostfix(s);
}

function parsePostfix(s: ParseState): number | string | boolean | null {
  const tok = peek(s);

  // Parenthesised expression
  if (tok.type === 'lparen') {
    consume(s);
    const val = parseExpr(s);
    if (val === null) return null;
    if (peek(s).type !== 'rparen') return null;
    consume(s);
    return val;
  }

  // Number literal
  if (tok.type === 'number') {
    consume(s);
    return tok.value;
  }

  // String literal
  if (tok.type === 'string') {
    consume(s);
    return tok.value;
  }

  // Boolean literal
  if (tok.type === 'bool') {
    consume(s);
    return tok.value;
  }

  // Identifier: variable or function call
  if (tok.type === 'ident') {
    consume(s);
    const name = tok.value;

    // Function call?
    if (peek(s).type === 'lparen') {
      consume(s); // (
      const args: (number | string | boolean)[] = [];
      while (peek(s).type !== 'rparen' && peek(s).type !== 'eof') {
        const arg = parseExpr(s);
        if (arg === null) return null;
        args.push(arg as number | string | boolean);
        if (peek(s).type === 'comma') consume(s);
      }
      if (peek(s).type !== 'rparen') return null;
      consume(s); // )
      return callBuiltin(name, args);
    }

    // Reject identifiers not in env and not known functions
    if (name in s.env) return s.env[name] ?? null;

    // Reject dot access (runtime expr) — already handled by tokeniser returning null for '.'
    return null; // unknown identifier
  }

  return null;
}

const KNOWN_FUNCTIONS = new Set(['pow', 'ceil', 'floor', 'abs']);

function callBuiltin(name: string, args: (number | string | boolean)[]): number | null {
  if (!KNOWN_FUNCTIONS.has(name)) return null;
  const nums = args as number[];
  switch (name) {
    case 'pow': return Math.pow(nums[0]!, nums[1]!);
    case 'ceil': return Math.ceil(nums[0]!);
    case 'floor': return Math.floor(nums[0]!);
    case 'abs': return Math.abs(nums[0]!);
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

export function evaluateCompileTime(expr: string, env: CompileTimeEnv): CompileTimeOutcome {
  // Reject runtime-only constructs early
  if (/now\(\)|\.where\(|\.map\(|\.any\(|\.all\(/.test(expr)) {
    return { ok: false, code: 'compile_time_expr_invalid', message: 'Runtime expression not allowed in compile-time context', expr };
  }
  // Reject dot-path access
  if (/[a-zA-Z_][a-zA-Z_0-9]*\.[a-zA-Z_]/.test(expr)) {
    return { ok: false, code: 'compile_time_expr_invalid', message: 'Path access not allowed in compile-time context', expr };
  }

  const tokens = tokenise(expr);
  if (tokens === null) {
    return { ok: false, code: 'compile_time_expr_invalid', message: `Invalid compile-time expression: ${expr}`, expr };
  }

  const state: ParseState = { tokens, pos: 0, env };
  const value = parseExpr(state);

  if (value === null || peek(state).type !== 'eof') {
    return { ok: false, code: 'compile_time_expr_invalid', message: `Invalid compile-time expression: ${expr}`, expr };
  }

  return { ok: true, value };
}

export function interpolate(template: string, env: CompileTimeEnv): CompileTimeOutcome {
  let result = '';
  let i = 0;
  const src = template;

  while (i < src.length) {
    const ch = src[i]!;
    // ${expr} form
    if (ch === '$' && src[i + 1] === '{') {
      i += 2;
      let expr = '';
      let depth = 1;
      while (i < src.length && depth > 0) {
        const c = src[i]!;
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
        expr += src[i++]!;
      }
      const outcome = evaluateCompileTime(expr, env);
      if (!outcome.ok) return outcome;
      result += String(outcome.value);
      continue;
    }

    // $name form
    if (ch === '$' && /[a-zA-Z_]/.test(src[i + 1] ?? '')) {
      i++;
      let name = '';
      while (i < src.length && /[a-zA-Z_0-9]/.test(src[i]!)) name += src[i++]!;
      if (!(name in env)) {
        return { ok: false, code: 'compile_time_expr_invalid', message: `Unknown variable: ${name}`, expr: template };
      }
      result += String(env[name]);
      continue;
    }

    result += src[i++]!;
  }

  return { ok: true, value: result };
}
