import type {
  ExpandedSection,
  SlotSource,
  ExpandedSlot,
  DeferredSlotCount,
  RoutingBlock,
  Comparator,
  AdminSentinel,
  AggregationFunction,
} from '../types.js';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface BracketParams {
  match_comparators: Comparator[];
  slots: number | string;
  assignment: number | 'dynamic' | AdminSentinel;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_SECTION: Omit<
  ExpandedSection,
  'name' | 'position' | 'section_type' | 'aggregation_function' | 'routing' | 'sections' | 'slots'
> = {
  scoring_unit_type: 'individual',
  non_participant_result: '"0"',
  time_window: {},
  capture_policy: { scrape: false, submit: true },
  registration_policy: { implicit: true },
  visibility_policy: {},
  matchmaking: { type: 'none' },
  awards: [],
  scoreboards: [],
};

function makeSlots(
  slotSpec: number | string,
  pos: number,
): { slots: SlotSource[]; deferred_slot_count?: DeferredSlotCount } {
  if (typeof slotSpec === 'string') {
    return {
      slots: [],
      deferred_slot_count: { kind: 'deferred_count', expr: slotSpec },
    };
  }
  const count = slotSpec > 0 ? slotSpec : 1;
  const slots: SlotSource[] = [];
  for (let s = 1; s <= count; s++) {
    slots.push({ seed_pattern: '', slot_index: (pos - 1) * count + s } as ExpandedSlot);
  }
  return { slots };
}

function matchupSection(
  name: string,
  position: number,
  params: BracketParams,
  routing: RoutingBlock,
): ExpandedSection {
  const { slots, deferred_slot_count } = makeSlots(params.slots, position);
  const aggregation_function: AggregationFunction = {
    fn: 'match_aggregate',
    match_comparators: params.match_comparators,
  };
  return {
    ...DEFAULT_SECTION,
    name,
    position,
    section_type: 'leaf',
    aggregation_function,
    routing,
    sections: [],
    slots,
    ...(deferred_slot_count ? { deferred_slot_count } : {}),
  };
}

// ---------------------------------------------------------------------------
// Single Elimination
// ---------------------------------------------------------------------------

export function singleElimination(params: BracketParams, unitCount: number): ExpandedSection[] {
  const rounds = Math.ceil(Math.log2(Math.max(unitCount, 2)));
  const sections: ExpandedSection[] = [];
  let matchupsInRound = Math.ceil(unitCount / 2);
  let position = 0;

  for (let round = 1; round <= rounds; round++) {
    const isFinal = round === rounds;
    for (let m = 1; m <= matchupsInRound; m++) {
      const name = `R${round}-M${m}`;
      const routing: RoutingBlock = {};

      if (isFinal) {
        routing['rank_1'] = { assigned_rank: 1 };
        routing['rank_2'] = { assigned_rank: 2 };
      } else {
        const nextM = Math.ceil(m / 2);
        routing['rank_1'] = { proceeds_to: `R${round + 1}-M${nextM}` };
        routing['rank_2'] = { eliminated: true };
      }

      sections.push(matchupSection(name, position++, params, routing));
    }
    matchupsInRound = Math.ceil(matchupsInRound / 2);
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Double Elimination
// ---------------------------------------------------------------------------

export function doubleElimination(params: BracketParams, unitCount: number): ExpandedSection[] {
  // Winners bracket (same as single elimination rounds)
  const wRounds = Math.ceil(Math.log2(Math.max(unitCount, 2)));
  const sections: ExpandedSection[] = [];
  let position = 0;

  // Winners bracket
  let wMatchups = Math.ceil(unitCount / 2);
  for (let round = 1; round <= wRounds; round++) {
    const isFinal = round === wRounds;
    for (let m = 1; m <= wMatchups; m++) {
      const name = `W${round}-M${m}`;
      const routing: RoutingBlock = {};
      if (isFinal) {
        routing['rank_1'] = { proceeds_to: 'Grand-Final' };
        routing['rank_2'] = { proceeds_to: `L${round * 2}-M1` };
      } else {
        routing['rank_1'] = { proceeds_to: `W${round + 1}-M${Math.ceil(m / 2)}` };
        routing['rank_2'] = { proceeds_to: `L${round * 2 - 1}-M${m}` };
      }
      sections.push(matchupSection(name, position++, params, routing));
    }
    wMatchups = Math.ceil(wMatchups / 2);
  }

  // Losers bracket (simplified: 2*(wRounds-1) losers rounds)
  for (let lr = 1; lr < wRounds * 2; lr++) {
    const lMatchups = Math.max(1, Math.ceil(unitCount / Math.pow(2, Math.ceil(lr / 2) + 1)));
    for (let m = 1; m <= lMatchups; m++) {
      const name = `L${lr}-M${m}`;
      const routing: RoutingBlock = {
        rank_1: lr === wRounds * 2 - 1 ? { proceeds_to: 'Grand-Final' } : { proceeds_to: `L${lr + 1}-M${Math.ceil(m / 2)}` },
        rank_2: { eliminated: true },
      };
      sections.push(matchupSection(name, position++, params, routing));
    }
  }

  // Grand Final
  sections.push(
    matchupSection('Grand-Final', position++, params, {
      rank_1: { assigned_rank: 1 },
      rank_2: { assigned_rank: 2 },
    }),
  );

  return sections;
}

// ---------------------------------------------------------------------------
// Stepladder
// ---------------------------------------------------------------------------

export function stepladder(params: BracketParams, unitCount: number): ExpandedSection[] {
  // N-1 matches chained: lowest vs next, winner plays next highest seed
  const n = Math.max(unitCount, 2);
  const sections: ExpandedSection[] = [];

  for (let step = 1; step <= n - 1; step++) {
    const name = `Step${step}`;
    const isFinal = step === n - 1;
    const routing: RoutingBlock = {
      rank_1: isFinal ? { assigned_rank: 1 } : { proceeds_to: `Step${step + 1}` },
      rank_2: { assigned_rank: n - step + 1 },
    };
    sections.push(matchupSection(name, step - 1, params, routing));
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Round Robin
// ---------------------------------------------------------------------------

export interface RoundRobinParams extends BracketParams {
  win_points?: number;
  draw_points?: number;
  loss_points?: number;
  tiebreakers?: string[];
}

export function roundRobin(params: RoundRobinParams, unitCount: number): ExpandedSection[] {
  const n = Math.max(unitCount, 2);
  const sections: ExpandedSection[] = [];
  let position = 0;

  // Generate all C(n,2) pairings
  let matchNum = 0;
  for (let a = 1; a <= n - 1; a++) {
    for (let b = a + 1; b <= n; b++) {
      matchNum++;
      const name = `RR-M${matchNum}`;
      const routing: RoutingBlock = {
        rank_1: { proceeds_to: 'RR-Standings' },
        rank_2: { proceeds_to: 'RR-Standings' },
      };
      const aggregation_function: AggregationFunction = {
        fn: 'match_aggregate',
        match_comparators: params.match_comparators,
        ...(params.win_points !== undefined ? { win_points: params.win_points } : {}),
        ...(params.draw_points !== undefined ? { draw_points: params.draw_points } : {}),
        ...(params.loss_points !== undefined ? { loss_points: params.loss_points } : {}),
        ...(params.tiebreakers ? { tiebreakers: params.tiebreakers } : {}),
      };
      const { slots, deferred_slot_count } = makeSlots(params.slots, position);
      sections.push({
        ...DEFAULT_SECTION,
        name,
        position: position++,
        section_type: 'leaf',
        aggregation_function,
        routing,
        sections: [],
        slots,
        ...(deferred_slot_count ? { deferred_slot_count } : {}),
      });
    }
  }

  // Standings section — aggregates match results
  const standingsAgg: AggregationFunction = {
    fn: 'derived_ranking',
    score: 'unit.match_points',
    rank_by: params.tiebreakers ?? ['unit.match_wins'],
  };
  sections.push({
    ...DEFAULT_SECTION,
    name: 'RR-Standings',
    position: position++,
    section_type: 'leaf',
    aggregation_function: standingsAgg,
    sections: [],
    slots: [],
    routing: {
      rank_1: { assigned_rank: 1 },
    },
  });

  return sections;
}
