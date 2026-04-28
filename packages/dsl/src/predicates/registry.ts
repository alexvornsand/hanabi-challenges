import type { GameContext, ScoringUnitContext } from '../types.js';
import type { EvalOutcome } from '../runtimeExpr/evaluator.js';
import { evalExpr } from '../runtimeExpr/evaluator.js';
import { parseExpr } from '../runtimeExpr/parser.js';

export interface PredicateFn {
  (context: GameContext | ScoringUnitContext, args: Record<string, unknown>): boolean;
}

export interface PredicateDefinition {
  name: string;
  contextType: 'game' | 'scoring_unit';
  params: Record<string, string>;
  fn: PredicateFn;
  nativeEquivalent: string;
}

export class PredicateRegistry {
  private _defs = new Map<string, PredicateDefinition>();

  register(def: PredicateDefinition): void {
    this._defs.set(def.name, def);
  }

  get(name: string): PredicateDefinition | undefined {
    return this._defs.get(name);
  }

  has(name: string): boolean {
    return this._defs.has(name);
  }

  list(): PredicateDefinition[] {
    return [...this._defs.values()];
  }
}

// ---------------------------------------------------------------------------
// Set equality helper
// ---------------------------------------------------------------------------

function isNumberArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'number');
}

function setEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every((x) => sa.has(x));
}

function setsOverlap(a: number[], b: number[]): boolean {
  const sa = new Set(a);
  return b.some((x) => sa.has(x));
}

// ---------------------------------------------------------------------------
// Built-in predicates
// ---------------------------------------------------------------------------

const builtins: PredicateDefinition[] = [
  {
    name: 'unit_exclusivity',
    contextType: 'game',
    params: {},
    nativeEquivalent:
      'all participants in game appear for only one scoring unit in the event',
    fn: (_ctx, _args) => {
      // In V1, this is enforced at DB/query level; here we return true as a placeholder
      // Full implementation requires cross-unit participant lookup
      return true;
    },
  },

  {
    name: 'participation_freshness',
    contextType: 'game',
    params: {},
    nativeEquivalent: 'no participant has played this spec previously in this event context',
    fn: (ctx, args) => {
      const gameCtx = ctx as GameContext;
      const priorGames = (args.prior_games ?? []) as Array<{ spec?: string; participants: number[] }>;
      const currentSpec = gameCtx.game.spec;
      if (!currentSpec) return true;
      const currentParticipants = gameCtx.game.participants;
      // A participant has played this spec if any prior game with the same spec overlaps
      for (const prior of priorGames) {
        if (prior.spec === currentSpec && setsOverlap(prior.participants, currentParticipants)) {
          return false;
        }
      }
      return true;
    },
  },

  {
    name: 'time_window_valid',
    contextType: 'game',
    params: { start: 'string?', end: 'string?' },
    nativeEquivalent:
      'game.datetime_start >= window.start and game.datetime_start <= window.end',
    fn: (ctx, args) => {
      const gameCtx = ctx as GameContext;
      const ts = gameCtx.game.datetime_start;
      if (!ts) return true;
      const gameTs = new Date(ts).getTime();
      const start = args.start ? new Date(args.start as string).getTime() : -Infinity;
      const end = args.end ? new Date(args.end as string).getTime() : Infinity;
      return gameTs >= start && gameTs <= end;
    },
  },

  {
    name: 'tag_present',
    contextType: 'game',
    params: { tag: 'string' },
    nativeEquivalent: 'tag in game.tags',
    fn: (ctx, args) => {
      const gameCtx = ctx as GameContext;
      const tags = gameCtx.game.tags ?? [];
      return tags.includes(args.tag as string);
    },
  },

  {
    name: 'lineup_valid',
    contextType: 'game',
    params: {},
    // DEFERRED: see docs/decisions/deferred.md#lineup_valid-predicate
    nativeEquivalent: 'all participants are on roster at time of play',
    fn: (_ctx, _args) => {
      // DEFERRED: see docs/decisions/deferred.md#lineup_valid-predicate
      return true;
    },
  },

  {
    name: 'stable_partnership',
    contextType: 'game',
    params: {},
    nativeEquivalent:
      'for each prior game P where P.participants overlaps game.participants: P.participants == game.participants (set equality)',
    fn: (ctx, args) => {
      const gameCtx = ctx as GameContext;
      const currentParticipants = gameCtx.game.participants;
      const priorGames = (args.prior_games ?? []) as Array<{ participants: number[] }>;
      for (const prior of priorGames) {
        if (setsOverlap(prior.participants, currentParticipants)) {
          if (!setEqual(prior.participants, currentParticipants)) {
            return false;
          }
        }
      }
      return true;
    },
  },
];

// ---------------------------------------------------------------------------
// Built-in registry singleton
// ---------------------------------------------------------------------------

export const builtinRegistry = new PredicateRegistry();
for (const pred of builtins) {
  builtinRegistry.register(pred);
}

// ---------------------------------------------------------------------------
// compileUserPredicates
// ---------------------------------------------------------------------------

export function compileUserPredicates(
  predicatesBlock: Record<string, unknown>,
  baseRegistry: PredicateRegistry,
  evalFn: typeof evalExpr,
): PredicateRegistry {
  const newRegistry = new PredicateRegistry();

  // Copy all built-ins into the new registry
  for (const def of baseRegistry.list()) {
    newRegistry.register(def);
  }

  // Register user-defined predicates
  for (const [name, value] of Object.entries(predicatesBlock)) {
    if (typeof value !== 'string') continue;

    const exprStr = value;
    newRegistry.register({
      name,
      contextType: 'scoring_unit',
      params: {},
      nativeEquivalent: exprStr,
      fn: (ctx, _args) => {
        const parsed = parseExpr(exprStr);
        if (!parsed.ok) return false;
        const result: EvalOutcome = evalFn(parsed.node, ctx as GameContext | ScoringUnitContext);
        return result.ok ? Boolean(result.value) : false;
      },
    });
  }

  return newRegistry;
}
