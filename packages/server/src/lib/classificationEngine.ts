import type { GameContext } from '@hanabi/dsl';
import { evalExpr } from '@hanabi/dsl/src/runtimeExpr/evaluator.js';
import { parseExpr } from '@hanabi/dsl/src/runtimeExpr/parser.js';
import { builtinRegistry } from '@hanabi/dsl/src/predicates/registry.js';
import type { PredicateRegistry } from '@hanabi/dsl/src/predicates/registry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClassifiedUnit {
  type: 'individual' | 'team';
  memberIds: number[];
  unitKey: string; // "team:1,2" or "individual:3"
  displayName: string;
}

export interface ClassificationResult {
  units: ClassifiedUnit[];
  gameAssignments: Map<number, string>; // gameId → unitKey
}

interface GameRecord {
  id: number;
  participants: number[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sortedKey(participants: number[]): string {
  return [...participants].sort((a, b) => a - b).join(',');
}

function teamKey(participants: number[]): string {
  return `team:${sortedKey(participants)}`;
}

function individualKey(userId: number): string {
  return `individual:${userId}`;
}

/**
 * Evaluate the classification rule for a single game.
 * Returns true if the game is "stable team", false if "individual".
 */
function evaluateRule(
  rule: string,
  game: GameRecord,
  priorGames: GameRecord[],
  registry: PredicateRegistry,
): boolean {
  // Check if rule is a named predicate
  const predDef = registry.get(rule);
  if (predDef) {
    // Build minimal GameContext
    const ctx: GameContext = {
      game: {
        points: 0,
        max_score: false,
        participants: game.participants,
      },
      unit: {
        id: 0,
        name: '',
        type: 'individual',
        score: 0,
        rank: 0,
        slot_results: [],
        section_scores: {},
        section_ranks: {},
        member_ids: [],
      },
      event: { slug: '', name: '', status: 'draft', sections: {} },
    };
    const result = predDef.fn(ctx, { prior_games: priorGames });
    return Boolean(result);
  }

  // Otherwise treat as an expression
  const parsed = parseExpr(rule);
  if (!parsed.ok) return false;

  const ctx: GameContext = {
    game: {
      points: 0,
      max_score: false,
      participants: game.participants,
    },
    unit: {
      id: 0,
      name: '',
      type: 'individual',
      score: 0,
      rank: 0,
      slot_results: [],
      section_scores: {},
      section_ranks: {},
      member_ids: [],
    },
    event: { slug: '', name: '', status: 'draft', sections: {} },
  };
  const result = evalExpr(parsed.node, ctx);
  if (!result.ok) return false;
  return Boolean(result.value);
}

// ---------------------------------------------------------------------------
// Core classification algorithm (pure)
// ---------------------------------------------------------------------------

export function classifyGames(
  games: GameRecord[],
  classificationRule: string,
  userNames: Map<number, string>,
  registry: PredicateRegistry = builtinRegistry,
): ClassificationResult {
  // Step 1+2: Classify each game
  const gameTeamKeys = new Map<number, string | null>(); // null = individual
  const priorGames: GameRecord[] = [];

  for (const game of games) {
    const isTeam = evaluateRule(classificationRule, game, priorGames, registry);
    gameTeamKeys.set(game.id, isTeam ? teamKey(game.participants) : null);
    priorGames.push(game);
  }

  // Step 5: Consistency check
  // If a player appears in both a stable-team game AND an individual game,
  // reclassify all their games as individual.
  const playerTeamGames = new Map<number, Set<string>>(); // userId → set of team keys
  const playerIndivGames = new Map<number, boolean>();     // userId → has individual game

  for (const game of games) {
    const tk = gameTeamKeys.get(game.id);
    for (const userId of game.participants) {
      if (!tk) {
        playerIndivGames.set(userId, true);
      } else {
        const existing = playerTeamGames.get(userId) ?? new Set<string>();
        existing.add(tk);
        playerTeamGames.set(userId, existing);
      }
    }
  }

  // Find players with mixed classification
  const forcedIndividual = new Set<number>();
  for (const userId of [...playerTeamGames.keys(), ...playerIndivGames.keys()]) {
    const hasTeam = (playerTeamGames.get(userId)?.size ?? 0) > 0;
    const hasIndiv = playerIndivGames.get(userId) ?? false;
    if (hasTeam && hasIndiv) {
      forcedIndividual.add(userId);
    }
  }

  // Reclassify games where any participant is forced individual
  const finalGameKeys = new Map<number, string | null>();
  for (const game of games) {
    const tk = gameTeamKeys.get(game.id);
    const hasForced = game.participants.some((id) => forcedIndividual.has(id));
    if (hasForced) {
      finalGameKeys.set(game.id, null); // individual
    } else {
      finalGameKeys.set(game.id, tk ?? null);
    }
  }

  // Step 6: Build unit map
  const unitMap = new Map<string, ClassifiedUnit>();

  for (const game of games) {
    const tk = finalGameKeys.get(game.id);

    if (tk !== null && tk !== undefined) {
      // Team
      if (!unitMap.has(tk)) {
        const sorted = [...game.participants].sort((a, b) => a - b);
        const names = sorted.map((id) => userNames.get(id) ?? String(id));
        names.sort();
        unitMap.set(tk, {
          type: 'team',
          memberIds: sorted,
          unitKey: tk,
          displayName: names.join(' & '),
        });
      }
    } else {
      // Individual — one unit per participant
      for (const userId of game.participants) {
        const key = individualKey(userId);
        if (!unitMap.has(key)) {
          unitMap.set(key, {
            type: 'individual',
            memberIds: [userId],
            unitKey: key,
            displayName: userNames.get(userId) ?? String(userId),
          });
        }
      }
    }
  }

  // Build gameAssignments
  const gameAssignments = new Map<number, string>();
  for (const game of games) {
    const tk = finalGameKeys.get(game.id);
    if (tk !== null && tk !== undefined) {
      gameAssignments.set(game.id, tk);
    } else {
      // For individual games, assign each participant's individual key
      // Primary assignment uses first participant (caller can expand if needed)
      for (const userId of game.participants) {
        gameAssignments.set(game.id, individualKey(userId));
        break; // Only one key per game in the map — multi-participant individual games need per-row handling
      }
    }
  }

  return {
    units: [...unitMap.values()],
    gameAssignments,
  };
}
