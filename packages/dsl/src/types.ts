// Colour tokens
export type SequentialToken =
  | 'diamond'
  | 'platinum'
  | 'gold'
  | 'silver'
  | 'bronze'
  | 'iron'
  | 'ash';
export type SemanticToken = 'pos-2' | 'pos-1' | 'mid' | 'neg-1' | 'neg-2';
export type HueToken =
  | 'green-0'
  | 'green-1'
  | 'green-2'
  | 'green-3'
  | 'green-4'
  | 'green-5'
  | 'green-6'
  | 'green-7'
  | 'green-8'
  | 'green-9'
  | 'blue-0'
  | 'blue-1'
  | 'blue-2'
  | 'blue-3'
  | 'blue-4'
  | 'blue-5'
  | 'blue-6'
  | 'blue-7'
  | 'blue-8'
  | 'blue-9'
  | 'magenta-0'
  | 'magenta-1'
  | 'magenta-2'
  | 'magenta-3'
  | 'magenta-4'
  | 'magenta-5'
  | 'magenta-6'
  | 'magenta-7'
  | 'magenta-8'
  | 'magenta-9';
export type ColourToken = SequentialToken | SemanticToken | HueToken;

// Admin sentinel
export type AdminSentinel = 'admin';
export const ADMIN: AdminSentinel = 'admin';

// Aggregation
export type ReduceOp = 'sum' | 'count' | 'avg' | 'min' | 'max' | 'first' | 'latest';

export interface AbsoluteAgg {
  reduce: ReduceOp;
  over?: string;
  value?: string; // Default: "item.points"
  where?: string;
  sort_by?: string;
  sort_direction?: 'ascending' | 'descending';
  take?: number | 'unlimited';
  skip?: number;
}

export type ComparatorShorthand =
  | 'points'
  | 'max_score'
  | 'points_star'
  | 'bdr'
  | 'turn_count'
  | 'strikes'
  | 'elapsed_time';
export interface Comparator {
  expr: string;
  direction: 'higher' | 'lower' | 'true_better';
}
export type ComparatorInput = Comparator | ComparatorShorthand;

export interface MatchAggregateAgg {
  fn: 'match_aggregate';
  match_comparators: ComparatorInput[];
  win_points?: number;
  draw_points?: number;
  loss_points?: number;
  tiebreakers?: string[];
  sequence_by?: 'slot_index' | 'timestamp' | 'section_position';
}

export interface EloAgg {
  fn: 'elo';
  initial_rating?: number;
  k_factor?: number;
  sequence_by?: 'slot_index' | 'timestamp' | 'section_position';
}

export interface DerivedRankingAgg {
  fn: 'derived_ranking';
  score: string;
  rank_by?: string[];
  rank_directions?: ('descending' | 'ascending')[];
  sequence_by?: 'slot_index' | 'timestamp' | 'section_position';
}

export type AggregationFunction = AbsoluteAgg | MatchAggregateAgg | EloAgg | DerivedRankingAgg;

// Policies
export interface TimeWindow {
  start?: string | AdminSentinel;
  end?: string | AdminSentinel;
}

export interface CapturePolicy {
  scrape?: boolean;
  scrape_schedule?: 'daily' | 'hourly' | 'on_demand';
  submit?: boolean;
  transition?: string;
}

export interface RegistrationPolicy {
  implicit?: boolean;
  explicit?: boolean;
  transition?: string;
  pool_units_allowed?: boolean;
}

export interface VisibilityPolicy {
  results_visible?: string;
  specs_visible?: string;
}

export interface AttemptModifier {
  enabled: boolean;
  count?: number | 'unlimited';
  aggregation?: AggregationFunction;
}

export interface MatchmakingNone {
  type: 'none';
}
export interface MatchmakingManual {
  type: 'manual';
}
export interface MatchmakingAlgorithmic {
  type: 'algorithmic';
  eligibility?: string;
  order_by?: string;
  grouping?: string;
  assignment?: number | 'dynamic' | AdminSentinel;
}
export type Matchmaking = MatchmakingNone | MatchmakingManual | MatchmakingAlgorithmic;

export interface ValidityRule {
  predicate: string;
}
export interface Advancement {
  predicate: string | AdminSentinel;
}

// Routing
export type RoutingRule =
  | { proceeds_to: string }
  | { eliminated: true }
  | { assigned_to: { section: string; position: string } }
  | { assigned_rank: number | string }
  | {
      when: string;
      proceeds_to?: string;
      assigned_rank?: number | string;
      otherwise?: RoutingRule;
    };
export type RoutingBlock = Record<string, RoutingRule>;

// Badge & Award
export type BadgeShape = 'circle' | 'shield' | 'star' | 'ribbon' | 'hex';
export type BadgeSize = 'regular' | 'large';
export interface BadgeConfig {
  primary_text: string;
  secondary_text?: string;
  shape?: BadgeShape;
  colour: ColourToken;
  size?: BadgeSize;
  icon?: string;
}
export interface Award {
  name: string;
  predicate: string | object;
  badge: BadgeConfig;
  when?: string;
}

// Scoreboard
export interface RankByClause {
  primary: { expr: string; direction: 'ascending' | 'descending' };
  tiebreakers?: Array<{ expr: string; direction: 'ascending' | 'descending'; visible?: string }>;
}
export interface Column {
  label: string;
  value: string;
  visible?: string;
  sortable?: boolean;
  for_each?: string;
}
export interface RowStyle {
  predicate: string;
  when?: string;
  label: string;
  accent: ColourToken;
  priority?: number;
}
export interface Scoreboard {
  name: string;
  primary?: boolean;
  featured?: string;
  scope: string;
  filter?: string;
  rank_by: RankByClause;
  columns: Column[];
  row_styles?: RowStyle[];
}

// Dimension
export type RegistrationCardinality = 'multiple' | 'one_per_unit' | 'organizer_assigned';
export interface Dimension {
  axis: 'player_count_class' | 'convention_system' | 'skill_tier' | 'format';
  values: string[];
  registration_cardinality: RegistrationCardinality;
  division_count?: number | string;
}

// Absence & P/R
export interface AbsencePolicy {
  demotion: string;
  floor?: string | 'bottom' | null;
  overflow?: 'waiting_list' | 'unranked' | 'discard';
}
export interface PromotionRelegation {
  fn: 'carry_balanced' | string;
  target_size: number;
  standard_promotions: number | string;
  standard_relegations: number | string;
  bottom_division: string | 'dynamic';
  clamp?: boolean;
}

// Raw config
export interface SlotConfig {
  seed_pattern?: string;
  assignment_trigger?: 'eager' | 'lazy';
  lazy_trigger?: 'completion' | 'action' | AdminSentinel;
  missing_score_default?: number;
  attempt_modifier?: AttemptModifier;
  validity_rules?: ValidityRule[];
  time_window?: TimeWindow;
}

export interface GeneratorDeclaration {
  returns: 'slot' | 'list[slot]' | 'section' | 'list[section]' | 'scoreboard' | 'badge';
  params?: Record<string, string>;
  value: unknown;
}

export interface GeneratorCall {
  generator: string;
  [key: string]: unknown;
}

export interface RawSection {
  name?: string;
  slug?: string;
  start?: string | AdminSentinel;
  organisers?: string[];
  dimensions?: Dimension[];
  absence_policy?: AbsencePolicy;
  promotion_relegation?: PromotionRelegation;
  scoring_unit_type?: 'individual' | 'team' | 'inferred';
  classification_rule?: string;
  unit_attribution?: 'share' | 'split';
  aggregation_function?: AggregationFunction;
  non_participant_result?: string;
  advancement?: Advancement;
  matchmaking?: Matchmaking;
  time_window?: TimeWindow;
  capture_policy?: CapturePolicy;
  registration_policy?: RegistrationPolicy;
  visibility_policy?: VisibilityPolicy;
  awards?: Award[];
  scoreboards?: Scoreboard[];
  conditional_activation?: string;
  routing?: RoutingBlock;
  sections?: Array<RawSection | GeneratorCall>;
  slots?: Array<SlotConfig | GeneratorCall>;
}

export interface RawEvent extends RawSection {
  name: string;
  slug: string;
}

export interface RawConfig {
  event: RawEvent;
  generators?: Record<string, GeneratorDeclaration>;
  predicates?: Record<string, unknown>;
}

// Diagnostics
export type DiagnosticSeverity = 'error' | 'warning' | 'notice';
export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  path?: string;
  line?: number;
}

// Pipeline outcomes
export interface ParseResult {
  ok: true;
  raw: RawConfig;
  diagnostics: Diagnostic[];
}
export interface ParseError {
  ok: false;
  diagnostics: Diagnostic[];
}
export type ParseOutcome = ParseResult | ParseError;

// Expanded types (populated by generator expander)
export interface ExpandedSlot extends SlotConfig {
  seed_pattern: string;
  slot_index: number;
}
export interface DeferredSlotGenerator {
  kind: 'deferred';
  trigger_type: 'attempt_start' | 'bracket_activation' | 'admin_sequence';
  generator_config: unknown;
  position: number;
}
export type SlotSource = ExpandedSlot | DeferredSlotGenerator;

export interface ExpandedSection {
  name: string;
  position: number;
  section_type: 'leaf' | 'branch';
  scoring_unit_type: 'individual' | 'team' | 'inferred';
  classification_rule?: string;
  unit_attribution?: 'share' | 'split';
  aggregation_function?: AggregationFunction;
  non_participant_result: string;
  time_window: TimeWindow;
  capture_policy: CapturePolicy;
  registration_policy: RegistrationPolicy;
  visibility_policy: VisibilityPolicy;
  conditional_activation?: string;
  advancement?: Advancement;
  matchmaking: Matchmaking;
  awards: Award[];
  scoreboards: Scoreboard[];
  routing?: RoutingBlock;
  sections: ExpandedSection[];
  slots: SlotSource[];
}

export interface ExpandedConfig {
  root: ExpandedSection;
  diagnostics: Diagnostic[];
}

// Pipeline result
export interface PipelineResult {
  parseResult?: ParseResult;
  resolvedConfig?: ResolvedConfig;
  expandedConfig?: ExpandedConfig;
  diagnostics: Diagnostic[];
  hasErrors: boolean;
  hasWarnings: boolean;
  canSave: boolean;
  canPublish: boolean;
}

export interface ResolvedSection extends RawSection {
  time_window: TimeWindow;
  capture_policy: CapturePolicy;
  registration_policy: RegistrationPolicy;
  visibility_policy: VisibilityPolicy;
  non_participant_result: string;
  scoring_unit_type: 'individual' | 'team' | 'inferred';
}
export interface ResolvedConfig {
  raw: RawConfig;
  resolved: ResolvedSection;
  diagnostics: Diagnostic[];
}

// Variant
export interface VariantInfo {
  id: number;
  name: string;
  short_name: string;
  max_score: number;
  suit_count: number;
}

// Seed engine
export interface SeedPatternContext {
  hasAttemptModifier: boolean;
  hasMultiRegistration: boolean;
}
export interface SeedBoundVars {
  eventID?: number;
  sectionID?: number;
  slotIndex?: number;
  teamID?: number;
  attemptID?: number;
}
export interface SeedConflict {
  spec: string;
  conflictsWith: string;
}

// Runtime expression AST
export type BinaryOp =
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | 'and'
  | 'or';
export type ExprNode =
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'path'; parts: string[] }
  | { kind: 'index'; object: ExprNode; key: ExprNode }
  | { kind: 'binary'; op: BinaryOp; left: ExprNode; right: ExprNode }
  | { kind: 'unary'; op: 'not' | '-'; operand: ExprNode }
  | { kind: 'ternary'; condition: ExprNode; then: ExprNode; else: ExprNode }
  | { kind: 'call'; name: string; args: ExprNode[] }
  | { kind: 'lambda'; param: string; body: ExprNode }
  | { kind: 'method'; object: ExprNode; method: string; args: ExprNode[] }
  | { kind: 'nullCoalesce'; left: ExprNode; right: ExprNode }
  | { kind: 'optChain'; object: ExprNode; key: string }
  | { kind: 'membership'; item: ExprNode; list: ExprNode }
  | { kind: 'crossEvent'; slug: string; rest: ExprNode | null }
  | { kind: 'sectionRef'; name: string };

// Shared scoreboard output types (used by both server and web)
export interface ComputedRow {
  unitId: number;
  unitName: string;
  unitType: 'individual' | 'team';
  rank: number;
  displayRank: number;
  score: number;
  columns: Record<string, unknown>;
  ribbon?: { accent: ColourToken; label: string };
  promotionStatus?: 'promoted' | 'relegated' | 'stayed' | 'absent' | 'overflow' | null;
  nextDivision?: string | null;
  isSpeculative: boolean;
}
export interface ComputedScoreboard {
  name: string;
  primary: boolean;
  rows: ComputedRow[];
  diagnostics: string[];
}

// Runtime context snapshots (used by expression evaluator)
export interface GameResult {
  points: number;
  max_score: boolean;
  points_star?: number;
  bdr?: number;
  turn_count?: number;
  strikes?: number;
  datetime_start?: string;
  datetime_end?: string;
  elapsed_time?: number;
  end_condition?: string;
  variant?: VariantInfo;
  participants: number[];
  spec?: string;
  source?: 'scraped' | 'submitted';
  tags?: string[];
}

export interface SlotResultSnapshot {
  slot_index: number;
  score: number;
  games: GameResult[];
}

export interface ScoringUnitSnapshot {
  id: number;
  name: string;
  type: 'individual' | 'team';
  score: number;
  rank: number;
  parent_score?: number;
  slot_results: SlotResultSnapshot[];
  advancement_round?: string | null;
  promotion_status?: string | null;
  next_division?: string | null;
  section_scores: Record<string, number>;
  section_ranks: Record<string, number>;
  member_ids: number[];
}

export interface SectionSnapshot {
  name: string;
  status: 'draft' | 'published' | 'closed';
  time_window: { start?: string; end?: string };
  results: ScoringUnitSnapshot[];
}

export interface EventSnapshot {
  slug: string;
  name: string;
  status: 'draft' | 'published' | 'closed';
  sections: Record<string, SectionSnapshot>;
}

export interface GameContext {
  game: GameResult;
  unit: ScoringUnitSnapshot;
  event: EventSnapshot;
}
export interface ScoringUnitContext {
  unit: ScoringUnitSnapshot;
  section: SectionSnapshot;
  event: EventSnapshot;
  tied_units?: ScoringUnitSnapshot[];
}
export interface EventContext {
  event: EventSnapshot;
}
export interface TransitionContext {
  registrant_count: number;
  prior_division_count: number;
}
