import type {
  ExprNode,
  GameContext,
  ScoringUnitContext,
  EventContext,
  TransitionContext,
  VariantInfo,
} from '../types.js';
import { parseExpr } from './parser.js';

export interface EvalSuccess {
  ok: true;
  value: unknown;
}
export interface EvalError {
  ok: false;
  message: string;
}
export type EvalOutcome = EvalSuccess | EvalError;

type EvalContext = GameContext | ScoringUnitContext | EventContext | TransitionContext;

// ---------------------------------------------------------------------------
// Participant set equality
// ---------------------------------------------------------------------------

function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'number');
}

function setEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every((x) => sa.has(x));
}

// ---------------------------------------------------------------------------
// Built-in functions
// ---------------------------------------------------------------------------

function evalBuiltin(
  name: string,
  args: unknown[],
  variants?: Map<number, VariantInfo>,
): EvalOutcome {
  switch (name) {
    case 'now':
      return { ok: true, value: Date.now() };
    case 'days':
      return { ok: true, value: (args[0] as number) * 86400000 };
    case 'hours':
      return { ok: true, value: (args[0] as number) * 3600000 };
    case 'minutes':
      return { ok: true, value: (args[0] as number) * 60000 };
    case 'bottom_division':
      return { ok: true, value: 'bottom_division' };
    case 'variant': {
      if (!variants) return { ok: false, message: 'variant() requires variants map' };
      const id = args[0] as number;
      const v = variants.get(id);
      return v ? { ok: true, value: v } : { ok: false, message: `Unknown variant id: ${id}` };
    }
    case 'variants': {
      if (!variants) return { ok: false, message: 'variants() requires variants map' };
      const ids = args[0] as number[];
      const vs = ids.map((id) => variants.get(id)).filter(Boolean);
      return { ok: true, value: vs };
    }
    case 'abs': return { ok: true, value: Math.abs(args[0] as number) };
    case 'ceil': return { ok: true, value: Math.ceil(args[0] as number) };
    case 'floor': return { ok: true, value: Math.floor(args[0] as number) };
    case 'min': return { ok: true, value: Math.min(...(args as number[])) };
    case 'max': return { ok: true, value: Math.max(...(args as number[])) };
    default:
      return { ok: false, message: `Unknown function: ${name}` };
  }
}

// ---------------------------------------------------------------------------
// Array method evaluation
// ---------------------------------------------------------------------------

function evalArrayMethod(
  arr: unknown[],
  method: string,
  args: unknown[],
  ctx: EvalContext,
  variants?: Map<number, VariantInfo>,
): EvalOutcome {
  switch (method) {
    case 'where':
    case 'filter': {
      const fn = args[0];
      if (typeof fn !== 'function') return { ok: false, message: '.where() requires a lambda' };
      const filtered = arr.filter((item) => fn(item));
      return { ok: true, value: filtered };
    }
    case 'map': {
      const fn = args[0];
      if (typeof fn !== 'function') return { ok: false, message: '.map() requires a lambda' };
      const mapped = arr.map((item) => fn(item));
      return { ok: true, value: mapped };
    }
    case 'any': {
      if (args[0] === undefined) return { ok: true, value: arr.length > 0 };
      const fn = args[0];
      if (typeof fn !== 'function') return { ok: false, message: '.any() requires a lambda' };
      return { ok: true, value: arr.some((item) => fn(item)) };
    }
    case 'all': {
      const fn = args[0];
      if (typeof fn !== 'function') return { ok: false, message: '.all() requires a lambda' };
      return { ok: true, value: arr.every((item) => fn(item)) };
    }
    case 'count':
      return { ok: true, value: arr.length };
    case 'sum':
      return { ok: true, value: arr.reduce((acc, x) => (acc as number) + (x as number), 0) };
    case 'avg': {
      if (arr.length === 0) return { ok: true, value: 0 };
      const s = arr.reduce((acc, x) => (acc as number) + (x as number), 0) as number;
      return { ok: true, value: s / arr.length };
    }
    case 'min':
      return { ok: true, value: arr.length === 0 ? null : Math.min(...(arr as number[])) };
    case 'max':
      return { ok: true, value: arr.length === 0 ? null : Math.max(...(arr as number[])) };
    case 'first':
      return { ok: true, value: arr[0] ?? null };
    case 'last':
      return { ok: true, value: arr[arr.length - 1] ?? null };
    case 'sort':
    case 'sort_by': {
      const fn = args[0];
      if (fn === undefined) return { ok: true, value: [...arr].sort() };
      if (typeof fn !== 'function') return { ok: false, message: '.sort_by() requires a lambda' };
      return { ok: true, value: [...arr].sort((a, b) => {
        const ka = fn(a);
        const kb = fn(b);
        return (ka as number) - (kb as number);
      })};
    }
    case 'flat':
    case 'flatten':
      return { ok: true, value: arr.flat() };
    case 'distinct':
    case 'unique':
      return { ok: true, value: [...new Set(arr)] };
    case 'includes':
    case 'contains':
      return { ok: true, value: arr.includes(args[0]) };
    case 'length':
      return { ok: true, value: arr.length };
    default:
      return { ok: false, message: `Unknown array method: ${method}` };
  }
}

// ---------------------------------------------------------------------------
// Path walking
// ---------------------------------------------------------------------------

function walkPath(obj: unknown, parts: string[]): unknown {
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return null;
    current = (current as Record<string, unknown>)[part];
  }
  return current ?? null;
}

// ---------------------------------------------------------------------------
// Main evaluator
// ---------------------------------------------------------------------------

export function evalExpr(
  node: ExprNode,
  context: EvalContext,
  variants?: Map<number, VariantInfo>,
): EvalOutcome {
  switch (node.kind) {
    case 'literal':
      return { ok: true, value: node.value };

    case 'path': {
      const value = walkPath(context, node.parts);
      return { ok: true, value };
    }

    case 'index': {
      const objResult = evalExpr(node.object, context, variants);
      if (!objResult.ok) return objResult;
      const keyResult = evalExpr(node.key, context, variants);
      if (!keyResult.ok) return keyResult;

      // crossEvent: object is crossEvent node — handled in crossEvent case
      const obj = objResult.value;
      const key = keyResult.value;
      if (obj === null || obj === undefined) return { ok: true, value: null };
      return { ok: true, value: (obj as Record<string | number, unknown>)[key as string | number] ?? null };
    }

    case 'binary': {
      if (node.op === 'and') {
        const l = evalExpr(node.left, context, variants);
        if (!l.ok) return l;
        if (!l.value) return { ok: true, value: false };
        return evalExpr(node.right, context, variants);
      }
      if (node.op === 'or') {
        const l = evalExpr(node.left, context, variants);
        if (!l.ok) return l;
        if (l.value) return { ok: true, value: true };
        return evalExpr(node.right, context, variants);
      }

      const lResult = evalExpr(node.left, context, variants);
      if (!lResult.ok) return lResult;
      const rResult = evalExpr(node.right, context, variants);
      if (!rResult.ok) return rResult;

      const lv = lResult.value;
      const rv = rResult.value;

      switch (node.op) {
        case '+': return { ok: true, value: (lv as number) + (rv as number) };
        case '-': return { ok: true, value: (lv as number) - (rv as number) };
        case '*': return { ok: true, value: (lv as number) * (rv as number) };
        case '/': return { ok: true, value: (lv as number) / (rv as number) };
        case '%': return { ok: true, value: (lv as number) % (rv as number) };
        case '<': return { ok: true, value: (lv as number) < (rv as number) };
        case '<=': return { ok: true, value: (lv as number) <= (rv as number) };
        case '>': return { ok: true, value: (lv as number) > (rv as number) };
        case '>=': return { ok: true, value: (lv as number) >= (rv as number) };
        case '==': {
          // Participant set equality
          if (isNumberArray(lv) && isNumberArray(rv)) {
            return { ok: true, value: setEqual(lv, rv) };
          }
          return { ok: true, value: lv === rv };
        }
        case '!=': {
          if (isNumberArray(lv) && isNumberArray(rv)) {
            return { ok: true, value: !setEqual(lv, rv) };
          }
          return { ok: true, value: lv !== rv };
        }
      }
      return { ok: false, message: `Unknown binary op: ${node.op}` };
    }

    case 'unary': {
      const operandResult = evalExpr(node.operand, context, variants);
      if (!operandResult.ok) return operandResult;
      if (node.op === '-') return { ok: true, value: -(operandResult.value as number) };
      if (node.op === 'not') return { ok: true, value: !operandResult.value };
      return { ok: false, message: `Unknown unary op: ${node.op}` };
    }

    case 'ternary': {
      const condResult = evalExpr(node.condition, context, variants);
      if (!condResult.ok) return condResult;
      return condResult.value
        ? evalExpr(node.then, context, variants)
        : evalExpr(node.else, context, variants);
    }

    case 'call': {
      const argResults: unknown[] = [];
      for (const arg of node.args) {
        const r = evalExpr(arg, context, variants);
        if (!r.ok) return r;
        argResults.push(r.value);
      }
      return evalBuiltin(node.name, argResults, variants);
    }

    case 'lambda': {
      // Return a JS function that evaluates the body with param bound
      const fn = (item: unknown): unknown => {
        const childCtx = { ...context, [node.param]: item } as EvalContext;
        const r = evalExpr(node.body, childCtx, variants);
        return r.ok ? r.value : null;
      };
      return { ok: true, value: fn };
    }

    case 'method': {
      // Special cases: section_score, rank_in
      const objResult = evalExpr(node.object, context, variants);
      if (!objResult.ok) return objResult;

      const obj = objResult.value;

      if (node.method === 'section_score' || node.method === 'rank_in') {
        // node.args[0] should be sectionRef
        const argNode = node.args[0];
        if (!argNode || argNode.kind !== 'sectionRef') {
          return { ok: false, message: `${node.method} requires section["name"] argument` };
        }
        const sectionName = argNode.name;
        const unit = (context as ScoringUnitContext).unit;
        if (!unit) return { ok: false, message: `${node.method} requires unit context` };
        if (node.method === 'section_score') {
          return { ok: true, value: unit.section_scores[sectionName] ?? null };
        } else {
          return { ok: true, value: unit.section_ranks[sectionName] ?? null };
        }
      }

      // Evaluate args
      const argResults: unknown[] = [];
      for (const arg of node.args) {
        const r = evalExpr(arg, context, variants);
        if (!r.ok) return r;
        argResults.push(r.value);
      }

      // Array methods
      if (Array.isArray(obj)) {
        return evalArrayMethod(obj, node.method, argResults, context, variants);
      }

      // Property access with no args (method with 0 args used as property accessor)
      if (argResults.length === 0 && obj !== null && typeof obj === 'object') {
        const val = (obj as Record<string, unknown>)[node.method];
        return { ok: true, value: val ?? null };
      }

      return { ok: false, message: `Cannot call method ${node.method} on non-array` };
    }

    case 'nullCoalesce': {
      const lResult = evalExpr(node.left, context, variants);
      if (!lResult.ok) return lResult;
      if (lResult.value !== null && lResult.value !== undefined) return lResult;
      return evalExpr(node.right, context, variants);
    }

    case 'optChain': {
      const objResult = evalExpr(node.object, context, variants);
      if (!objResult.ok) return objResult;
      const obj = objResult.value;
      if (obj === null || obj === undefined) return { ok: true, value: null };
      return { ok: true, value: (obj as Record<string, unknown>)[node.key] ?? null };
    }

    case 'membership': {
      const itemResult = evalExpr(node.item, context, variants);
      if (!itemResult.ok) return itemResult;
      const listResult = evalExpr(node.list, context, variants);
      if (!listResult.ok) return listResult;
      const list = listResult.value;
      if (!Array.isArray(list)) return { ok: false, message: '"in" operator requires a list on the right' };
      return { ok: true, value: list.includes(itemResult.value) };
    }

    case 'crossEvent':
      // DEFERRED: see docs/decisions/deferred.md#cross-event-references
      return { ok: false, message: 'cross-event references are deferred — not implemented in V1' };

    case 'sectionRef':
      return { ok: true, value: node.name };

    default:
      return { ok: false, message: `Unknown node kind: ${(node as ExprNode).kind}` };
  }
}

// ---------------------------------------------------------------------------
// YAML control flow structures
// ---------------------------------------------------------------------------

export function evalYamlControlFlow(
  structure: unknown,
  context: ScoringUnitContext | GameContext | EventContext,
  variants?: Map<number, VariantInfo>,
): EvalOutcome {
  if (typeof structure === 'string') {
    const parsed = parseExpr(structure);
    if (!parsed.ok) return { ok: false, message: parsed.message };
    return evalExpr(parsed.node, context, variants);
  }

  if (structure !== null && typeof structure === 'object' && !Array.isArray(structure)) {
    const obj = structure as Record<string, unknown>;

    if ('all' in obj) {
      const items = Array.isArray(obj.all) ? obj.all : [obj.all];
      for (const item of items) {
        const r = evalYamlControlFlow(item, context, variants);
        if (!r.ok) return r;
        if (!r.value) return { ok: true, value: false };
      }
      return { ok: true, value: true };
    }

    if ('any' in obj) {
      const items = Array.isArray(obj.any) ? obj.any : [obj.any];
      for (const item of items) {
        const r = evalYamlControlFlow(item, context, variants);
        if (!r.ok) return r;
        if (r.value) return { ok: true, value: true };
      }
      return { ok: true, value: false };
    }

    if ('not' in obj) {
      const r = evalYamlControlFlow(obj.not, context, variants);
      if (!r.ok) return r;
      return { ok: true, value: !r.value };
    }

    if ('and' in obj) {
      const items = Array.isArray(obj.and) ? obj.and : [obj.and];
      for (const item of items) {
        const r = evalYamlControlFlow(item, context, variants);
        if (!r.ok) return r;
        if (!r.value) return { ok: true, value: false };
      }
      return { ok: true, value: true };
    }

    if ('or' in obj) {
      const items = Array.isArray(obj.or) ? obj.or : [obj.or];
      for (const item of items) {
        const r = evalYamlControlFlow(item, context, variants);
        if (!r.ok) return r;
        if (r.value) return { ok: true, value: true };
      }
      return { ok: true, value: false };
    }
  }

  return { ok: false, message: `Unrecognized YAML control flow structure: ${JSON.stringify(structure)}` };
}
