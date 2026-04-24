import * as yaml from 'yaml';
import { z } from 'zod';
import type {
  ParseOutcome,
  ParseResult,
  RawConfig,
  Diagnostic,
  Comparator,
  ComparatorShorthand,
  ComparatorInput,
} from './types.js';

// ---------------------------------------------------------------------------
// Line-map helpers
// ---------------------------------------------------------------------------

export function buildLineMap(source: string): number[] {
  const lineMap: number[] = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\n') {
      lineMap.push(i + 1);
    }
  }
  return lineMap;
}

export function offsetToLine(lineMap: number[], offset: number): number {
  let lo = 0;
  let hi = lineMap.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (lineMap[mid] <= offset) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo + 1; // 1-based
}

// ---------------------------------------------------------------------------
// Comparator shorthands
// ---------------------------------------------------------------------------

export const COMPARATOR_SHORTHANDS: Record<ComparatorShorthand, Comparator> = {
  points: { expr: 'game.points', direction: 'higher' },
  max_score: { expr: 'game.max_score', direction: 'true_better' },
  points_star: { expr: 'game.points_star', direction: 'higher' },
  bdr: { expr: 'game.bdr', direction: 'lower' },
  turn_count: { expr: 'game.turn_count', direction: 'lower' },
  strikes: { expr: 'game.strikes', direction: 'lower' },
  elapsed_time: { expr: 'game.elapsed_time', direction: 'lower' },
};

const SHORTHAND_NAMES = new Set<string>(Object.keys(COMPARATOR_SHORTHANDS));

function expandComparatorInput(input: unknown): unknown {
  if (typeof input === 'string' && SHORTHAND_NAMES.has(input)) {
    return COMPARATOR_SHORTHANDS[input as ComparatorShorthand];
  }
  return input;
}

function expandComparatorsDeep(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(expandComparatorsDeep);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k === 'match_comparators' && Array.isArray(v)) {
        result[k] = v.map((item) => expandComparatorInput(item));
      } else {
        result[k] = expandComparatorsDeep(v);
      }
    }
    return result;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Priority defaults for row_styles and awards
// ---------------------------------------------------------------------------

function applyPriorityDefaults(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(applyPriorityDefaults);
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if ((k === 'row_styles' || k === 'awards') && Array.isArray(v)) {
        result[k] = v.map((item: unknown, index: number) => {
          if (item !== null && typeof item === 'object') {
            const entry = item as Record<string, unknown>;
            return {
              ...entry,
              when: entry.when ?? '"true"',
              ...(k === 'row_styles' && entry.priority === undefined ? { priority: index } : {}),
            };
          }
          return item;
        });
      } else {
        result[k] = applyPriorityDefaults(v);
      }
    }
    return result;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const timeWindowSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
});

const capturePolicySchema = z.object({
  scrape: z.boolean().optional(),
  scrape_schedule: z.enum(['daily', 'hourly', 'on_demand']).optional(),
  submit: z.boolean().optional(),
  transition: z.string().optional(),
});

const registrationPolicySchema = z.object({
  implicit: z.boolean().optional(),
  explicit: z.boolean().optional(),
  transition: z.string().optional(),
  pool_units_allowed: z.boolean().optional(),
});

const visibilityPolicySchema = z.object({
  results_visible: z.string().optional(),
  specs_visible: z.string().optional(),
});

const comparatorSchema = z.union([
  z.object({ expr: z.string(), direction: z.enum(['higher', 'lower', 'true_better']) }),
  z.enum(['points', 'max_score', 'points_star', 'bdr', 'turn_count', 'strikes', 'elapsed_time']),
]);

const absoluteAggSchema = z.object({
  reduce: z.enum(['sum', 'count', 'avg', 'min', 'max', 'first', 'latest']),
  over: z.string().optional(),
  value: z.string().optional(),
  where: z.string().optional(),
  sort_by: z.string().optional(),
  sort_direction: z.enum(['ascending', 'descending']).optional(),
  take: z.union([z.number(), z.literal('unlimited')]).optional(),
  skip: z.number().optional(),
});

const matchAggSchema = z.object({
  fn: z.literal('match_aggregate'),
  match_comparators: z.array(comparatorSchema),
  win_points: z.number().optional(),
  draw_points: z.number().optional(),
  loss_points: z.number().optional(),
  tiebreakers: z.array(z.string()).optional(),
  sequence_by: z.enum(['slot_index', 'timestamp', 'section_position']).optional(),
});

const eloAggSchema = z.object({
  fn: z.literal('elo'),
  initial_rating: z.number().optional(),
  k_factor: z.number().optional(),
  sequence_by: z.enum(['slot_index', 'timestamp', 'section_position']).optional(),
});

const derivedRankingAggSchema = z.object({
  fn: z.literal('derived_ranking'),
  score: z.string(),
  rank_by: z.array(z.string()).optional(),
  rank_directions: z.array(z.enum(['descending', 'ascending'])).optional(),
  sequence_by: z.enum(['slot_index', 'timestamp', 'section_position']).optional(),
});

// Reject removal_bracket upfront
const eliminationBracketAggSchema = z.object({
  fn: z.literal('elimination_bracket'),
});

const aggregationFunctionSchema = z.union([
  eliminationBracketAggSchema,
  absoluteAggSchema,
  matchAggSchema,
  eloAggSchema,
  derivedRankingAggSchema,
]);

const attemptModifierSchema = z.object({
  enabled: z.boolean(),
  count: z.union([z.number(), z.literal('unlimited')]).optional(),
  aggregation: z.lazy(() => aggregationFunctionSchema).optional(),
});

const matchmakingSchema = z.union([
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('manual') }),
  z.object({
    type: z.literal('algorithmic'),
    eligibility: z.string().optional(),
    order_by: z.string().optional(),
    grouping: z.string().optional(),
    assignment: z.union([z.number(), z.literal('dynamic'), z.literal('admin')]).optional(),
  }),
]);

const validityRuleSchema = z.object({ predicate: z.string() });
const advancementSchema = z.object({
  predicate: z.union([z.string(), z.literal('admin')]),
});

const badgeConfigSchema = z.object({
  primary_text: z.string(),
  secondary_text: z.string().optional(),
  shape: z.enum(['circle', 'shield', 'star', 'ribbon', 'hex']).optional(),
  colour: z.string(),
  size: z.enum(['regular', 'large']).optional(),
  icon: z.string().optional(),
});

const awardSchema = z.object({
  name: z.string(),
  predicate: z.union([z.string(), z.record(z.unknown())]),
  badge: badgeConfigSchema,
  when: z.string().optional(),
});

const columnSchema = z.object({
  label: z.string(),
  value: z.string(),
  visible: z.string().optional(),
  sortable: z.boolean().optional(),
  for_each: z.string().optional(),
});

const rowStyleSchema = z.object({
  predicate: z.string(),
  when: z.string().optional(),
  label: z.string(),
  accent: z.string(),
  priority: z.number().optional(),
});

const rankByClauseSchema = z.object({
  primary: z.object({
    expr: z.string(),
    direction: z.enum(['ascending', 'descending']),
  }),
  tiebreakers: z
    .array(
      z.object({
        expr: z.string(),
        direction: z.enum(['ascending', 'descending']),
        visible: z.string().optional(),
      }),
    )
    .optional(),
});

const scoreboardSchema = z.object({
  name: z.string(),
  primary: z.boolean().optional(),
  featured: z.string().optional(),
  scope: z.string(),
  filter: z.string().optional(),
  rank_by: rankByClauseSchema,
  columns: z.array(columnSchema),
  row_styles: z.array(rowStyleSchema).optional(),
});

const dimensionSchema = z.object({
  axis: z.enum(['player_count_class', 'convention_system', 'skill_tier', 'format']),
  values: z.array(z.string()),
  registration_cardinality: z.enum(['multiple', 'one_per_unit', 'organizer_assigned']),
  division_count: z.union([z.number(), z.string()]).optional(),
});

const absencePolicySchema = z.object({
  demotion: z.string(),
  floor: z.union([z.string(), z.literal('bottom'), z.null()]).optional(),
  overflow: z.enum(['waiting_list', 'unranked', 'discard']).optional(),
});

const promotionRelegationSchema = z.object({
  fn: z.string(),
  target_size: z.number(),
  standard_promotions: z.union([z.number(), z.string()]),
  standard_relegations: z.union([z.number(), z.string()]),
  bottom_division: z.union([z.string(), z.literal('dynamic')]),
  clamp: z.boolean().optional(),
});

const slotConfigSchema = z.object({
  seed_pattern: z.string().optional(),
  assignment_trigger: z.enum(['eager', 'lazy']).optional(),
  lazy_trigger: z.union([z.enum(['completion', 'action']), z.literal('admin')]).optional(),
  missing_score_default: z.number().optional(),
  attempt_modifier: attemptModifierSchema.optional(),
  validity_rules: z.array(validityRuleSchema).optional(),
  time_window: timeWindowSchema.optional(),
});

const generatorCallSchema = z.object({ generator: z.string() }).passthrough();

// Forward declaration for recursive section
type RawSectionInput = z.infer<typeof rawSectionSchema>;
const rawSectionSchema: z.ZodType<RawSectionInput> = z.lazy(() =>
  z.object({
    name: z.string().optional(),
    slug: z.string().optional(),
    start: z.string().optional(),
    organisers: z.array(z.string()).optional(),
    dimensions: z.array(dimensionSchema).optional(),
    absence_policy: absencePolicySchema.optional(),
    promotion_relegation: promotionRelegationSchema.optional(),
    scoring_unit_type: z
      .enum(['individual', 'team', 'inferred'])
      .refine((v) => v !== ('resolved' as string), {
        message: 'scoring_unit_type "resolved" has been removed; use "inferred" instead',
      })
      .optional(),
    classification_rule: z.string().optional(),
    unit_attribution: z.enum(['share', 'split']).optional(),
    aggregation_function: aggregationFunctionSchema.optional(),
    non_participant_result: z.string().optional(),
    advancement: advancementSchema.optional(),
    matchmaking: matchmakingSchema.optional(),
    time_window: timeWindowSchema.optional(),
    capture_policy: capturePolicySchema.optional(),
    registration_policy: registrationPolicySchema.optional(),
    visibility_policy: visibilityPolicySchema.optional(),
    awards: z.array(awardSchema).optional(),
    scoreboards: z.array(scoreboardSchema).optional(),
    conditional_activation: z.string().optional(),
    routing: z.record(z.unknown()).optional(),
    sections: z.array(z.union([generatorCallSchema, z.lazy(() => rawSectionSchema)])).optional(),
    slots: z.array(z.union([generatorCallSchema, slotConfigSchema])).optional(),
    // Legacy keys that should produce errors
    slots_per_match: z.undefined(),
  }),
);

const rawEventSchema = rawSectionSchema.and(
  z.object({
    name: z.string(),
    slug: z.string(),
  }),
);

const generatorDeclarationSchema = z.object({
  returns: z.enum(['slot', 'list[slot]', 'section', 'list[section]', 'scoreboard', 'badge']),
  params: z.record(z.string()).optional(),
  value: z.unknown(),
});

const rawConfigSchema = z.object({
  event: rawEventSchema,
  generators: z.record(generatorDeclarationSchema).optional(),
  predicates: z.record(z.unknown()).optional(),
  // Legacy top-level keys
  badges: z.undefined(),
});

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseConfig(yamlStr: string): ParseOutcome {
  const lineMap = buildLineMap(yamlStr);
  const diagnostics: Diagnostic[] = [];

  // Step 1: YAML parse
  let doc: yaml.Document;
  try {
    doc = yaml.parseDocument(yamlStr, { prettyErrors: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      diagnostics: [
        { code: 'yaml_syntax_error', severity: 'error', message: msg, line: 1 },
      ],
    };
  }

  if (doc.errors && doc.errors.length > 0) {
    return {
      ok: false,
      diagnostics: doc.errors.map((err) => {
        const line = err.pos ? offsetToLine(lineMap, err.pos[0]) : undefined;
        return {
          code: 'yaml_syntax_error',
          severity: 'error' as const,
          message: err.message,
          line,
        };
      }),
    };
  }

  const raw = doc.toJS() as unknown;

  // Step 2: Validate root has `event` key
  if (raw === null || typeof raw !== 'object' || !('event' in (raw as object))) {
    return {
      ok: false,
      diagnostics: [
        {
          code: 'missing_event_key',
          severity: 'error',
          message: 'Configuration must have a top-level "event" key',
        },
      ],
    };
  }

  // Check for legacy top-level `badges` block
  if ('badges' in (raw as object)) {
    diagnostics.push({
      code: 'top_level_badges_removed',
      severity: 'warning',
      message:
        'Top-level "badges" block has been removed. Define badges inline on awards or scoreboards.',
    });
  }

  // Step 3: Check for removed/renamed fields before full Zod validation
  const rawObj = raw as Record<string, unknown>;

  // slots_per_match renamed to slots
  const slotsPerMatchPaths = findPaths(rawObj, 'slots_per_match');
  if (slotsPerMatchPaths.length > 0) {
    return {
      ok: false,
      diagnostics: [
        {
          code: 'schema_error',
          severity: 'error',
          message: '"slots_per_match" has been renamed to "slots"',
          path: slotsPerMatchPaths[0],
        },
      ],
    };
  }

  // scoring_unit_type: 'resolved' check
  const resolvedPaths = findPathsWithValue(rawObj, 'scoring_unit_type', 'resolved');
  if (resolvedPaths.length > 0) {
    return {
      ok: false,
      diagnostics: [
        {
          code: 'schema_error',
          severity: 'error',
          message: 'scoring_unit_type "resolved" has been removed; use "inferred" instead',
          path: resolvedPaths[0],
        },
      ],
    };
  }

  // aggregation_function.fn: 'elimination_bracket'
  const elimPaths = findPathsWithValue(rawObj, 'fn', 'elimination_bracket');
  if (elimPaths.length > 0) {
    return {
      ok: false,
      diagnostics: [
        {
          code: 'elimination_bracket_removed',
          severity: 'error',
          message:
            'Use derived_ranking with score: "unit.advancement_round ?? 0" instead',
          path: elimPaths[0],
        },
      ],
    };
  }

  // matchmaking.type: 'forced' or 'support'
  const forcedPaths = findPathsWithValue(rawObj, 'type', 'forced');
  const supportPaths = findPathsWithValue(rawObj, 'type', 'support');
  const invalidMatchmakingPaths = [...forcedPaths, ...supportPaths].filter(
    (p) => p.includes('matchmaking'),
  );
  if (invalidMatchmakingPaths.length > 0) {
    return {
      ok: false,
      diagnostics: [
        {
          code: 'schema_error',
          severity: 'error',
          message:
            'matchmaking.type "forced" and "support" have been removed; use "algorithmic" or "manual"',
          path: invalidMatchmakingPaths[0],
        },
      ],
    };
  }

  // Step 4: Expand comparator shorthands
  const expanded = expandComparatorsDeep(raw) as Record<string, unknown>;

  // Step 5: Apply priority defaults
  const withDefaults = applyPriorityDefaults(expanded) as Record<string, unknown>;

  // Step 6: Full Zod validation
  const result = rawConfigSchema.safeParse(withDefaults);
  if (!result.success) {
    const zodDiagnostics: Diagnostic[] = result.error.errors.map((err) => ({
      code: 'schema_error',
      severity: 'error' as const,
      message: err.message,
      path: err.path.join('.'),
    }));
    return { ok: false, diagnostics: zodDiagnostics };
  }

  return {
    ok: true,
    raw: result.data as RawConfig,
    diagnostics,
  };
}

// ---------------------------------------------------------------------------
// Path-finding helpers
// ---------------------------------------------------------------------------

function findPaths(obj: unknown, key: string, prefix = ''): string[] {
  if (Array.isArray(obj)) {
    return obj.flatMap((item, i) => findPaths(item, key, `${prefix}[${i}]`));
  }
  if (obj !== null && typeof obj === 'object') {
    const results: string[] = [];
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (k === key) results.push(path);
      results.push(...findPaths(v, key, path));
    }
    return results;
  }
  return [];
}

function findPathsWithValue(obj: unknown, key: string, value: string, prefix = ''): string[] {
  if (Array.isArray(obj)) {
    return obj.flatMap((item, i) => findPathsWithValue(item, key, value, `${prefix}[${i}]`));
  }
  if (obj !== null && typeof obj === 'object') {
    const results: string[] = [];
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (k === key && v === value) results.push(path);
      results.push(...findPathsWithValue(v, key, value, path));
    }
    return results;
  }
  return [];
}
