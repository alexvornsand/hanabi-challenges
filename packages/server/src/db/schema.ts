import {
  AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

// sections — recursive, self-referential. Root sections are events.
export const sections = pgTable('sections', {
  id: serial('id').primaryKey(),
  parentId: integer('parent_id').references((): AnyPgColumn => sections.id), // nullable
  slug: text('slug').unique(), // nullable; root only
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  sectionType: text('section_type').notNull(), // 'leaf' | 'branch'
  status: text('status').notNull().default('draft'), // 'draft' | 'published' | 'closed'
  start: timestamp('start'), // nullable
  scoringUnitType: text('scoring_unit_type').notNull().default('individual'),
  classificationRule: text('classification_rule'), // nullable
  unitAttribution: text('unit_attribution'), // nullable: 'share' | 'split'
  config: jsonb('config').notNull().default('{}'), // raw user-authored YAML
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// event_organisers
export const eventOrganisers = pgTable(
  'event_organisers',
  {
    id: serial('id').primaryKey(),
    eventId: integer('event_id')
      .notNull()
      .references(() => sections.id),
    userId: integer('user_id').notNull(),
  },
  (t) => ({ uniq: unique().on(t.eventId, t.userId) }),
);

// teams — persistent across events
export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// team_members — which players are on a team
export const teamMembers = pgTable(
  'team_members',
  {
    id: serial('id').primaryKey(),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id),
    userId: integer('user_id').notNull(),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
    leftAt: timestamp('left_at'), // nullable; null means current member
  },
  (t) => ({ uniq: unique().on(t.teamId, t.userId) }),
);

// registrations — which scoring unit is registered for which event+division
// scoring_unit_id is either a userId (individual) or teamId (team), disambiguated by unit_type
export const registrations = pgTable(
  'registrations',
  {
    id: serial('id').primaryKey(),
    eventId: integer('event_id')
      .notNull()
      .references(() => sections.id),
    unitType: text('unit_type').notNull(), // 'individual' | 'team'
    unitId: integer('unit_id').notNull(), // userId or teamId
    dimensionAxis: text('dimension_axis').notNull(),
    divisionValue: text('division_value').notNull(),
    registeredAt: timestamp('registered_at').notNull().defaultNow(),
    registeredBy: integer('registered_by').notNull(), // userId
  },
  (t) => ({
    uniq: unique().on(t.eventId, t.unitType, t.unitId, t.dimensionAxis),
  }),
);

// slots
export const slots = pgTable('slots', {
  id: serial('id').primaryKey(),
  sectionId: integer('section_id')
    .notNull()
    .references(() => sections.id),
  slotIndex: integer('slot_index').notNull(),
  assignmentTrigger: text('assignment_trigger').notNull().default('eager'),
  lazyTrigger: text('lazy_trigger'), // nullable: 'completion' | 'action' | 'admin'
  missingScoreDefault: integer('missing_score_default').notNull().default(0),
  status: text('status').notNull().default('pending'), // 'pending' | 'issued' | 'completed'
  config: jsonb('config').notNull().default('{}'),
});

// deferred_slot_generators
export const deferredSlotGenerators = pgTable('deferred_slot_generators', {
  id: serial('id').primaryKey(),
  sectionId: integer('section_id')
    .notNull()
    .references(() => sections.id),
  position: integer('position').notNull(),
  triggerType: text('trigger_type').notNull(), // 'attempt_start' | 'bracket_activation' | 'admin_sequence'
  generatorConfig: jsonb('generator_config').notNull().default('{}'),
});

// scoreboards
export const scoreboards = pgTable('scoreboards', {
  id: serial('id').primaryKey(),
  sectionId: integer('section_id')
    .notNull()
    .references(() => sections.id),
  name: text('name').notNull(),
  scopeExpr: text('scope_expr').notNull(),
  isPrimary: boolean('is_primary').notNull().default(false),
  config: jsonb('config').notNull().default('{}'),
});

// awards
export const awards = pgTable('awards', {
  id: serial('id').primaryKey(),
  sectionId: integer('section_id')
    .notNull()
    .references(() => sections.id),
  awardName: text('award_name').notNull(),
  predicateExpr: text('predicate_expr').notNull(),
  whenExpr: text('when_expr').notNull().default('"true"'),
  badgeConfig: jsonb('badge_config').notNull(),
  config: jsonb('config').notNull().default('{}'),
});

// award_issuances — append-only, never deleted
export const awardIssuances = pgTable(
  'award_issuances',
  {
    id: serial('id').primaryKey(),
    awardId: integer('award_id')
      .notNull()
      .references(() => awards.id),
    userId: integer('user_id').notNull(),
    issuedAt: timestamp('issued_at').notNull().defaultNow(),
  },
  (t) => ({ uniq: unique().on(t.awardId, t.userId) }),
);

// admin_inputs
export const adminInputs = pgTable('admin_inputs', {
  id: serial('id').primaryKey(),
  sectionId: integer('section_id').references(() => sections.id),
  slotId: integer('slot_id').references(() => slots.id),
  fieldPath: text('field_path').notNull(),
  value: jsonb('value').notNull(),
  setAt: timestamp('set_at').notNull().defaultNow(),
  setBy: integer('set_by').notNull(),
});

// game_specs
export const gameSpecs = pgTable(
  'game_specs',
  {
    id: serial('id').primaryKey(),
    specString: text('spec_string').notNull().unique(),
    sectionId: integer('section_id')
      .notNull()
      .references(() => sections.id),
    slotId: integer('slot_id').references(() => slots.id),
    slotIndex: integer('slot_index').notNull(),
    issuedAt: timestamp('issued_at').notNull().defaultNow(),
  },
  (t) => ({ specIdx: index('game_specs_spec_string_idx').on(t.specString) }),
);

// games — append-only
export const games = pgTable(
  'games',
  {
    id: serial('id').primaryKey(),
    specId: integer('spec_id')
      .notNull()
      .references(() => gameSpecs.id),
    participants: jsonb('participants').notNull(), // userId[]
    result: jsonb('result').notNull(),
    gameTimestamp: timestamp('game_timestamp').notNull(),
    source: text('source').notNull(), // 'scraped' | 'submitted'
    tags: jsonb('tags').notNull().default('[]'),
    gameResultPayload: jsonb('game_result_payload').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    specIdx: index('games_spec_id_idx').on(t.specId),
    tsIdx: index('games_timestamp_idx').on(t.gameTimestamp),
  }),
);

// spoilages — append-only
export const spoilages = pgTable(
  'spoilages',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull(),
    specId: integer('spec_id')
      .notNull()
      .references(() => gameSpecs.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({ uniq: unique().on(t.userId, t.specId) }),
);

// variant_registry
export const variantRegistry = pgTable('variant_registry', {
  id: serial('id').primaryKey(),
  variantId: integer('variant_id').notNull().unique(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  maxScore: integer('max_score').notNull(),
  suitCount: integer('suit_count').notNull(),
});

// colour_token_registry
export const colourTokenRegistry = pgTable('colour_token_registry', {
  id: serial('id').primaryKey(),
  token: text('token').notNull().unique(),
  system: text('system').notNull(),
  lightHex: text('light_hex').notNull(),
  darkHex: text('dark_hex').notNull(),
});

// division_assignments — per scoring unit per event, carries absence counter
export const divisionAssignments = pgTable(
  'division_assignments',
  {
    id: serial('id').primaryKey(),
    unitType: text('unit_type').notNull(), // 'individual' | 'team'
    unitId: integer('unit_id').notNull(),
    eventId: integer('event_id')
      .notNull()
      .references(() => sections.id),
    dimensionAxis: text('dimension_axis').notNull(),
    divisionValue: text('division_value').notNull(),
    absenceEvents: integer('absence_events').notNull().default(0),
  },
  (t) => ({
    uniq: unique().on(t.unitType, t.unitId, t.eventId, t.dimensionAxis),
    eventAxisIdx: index('division_assignments_event_axis_idx').on(t.eventId, t.dimensionAxis),
  }),
);

// speculative_pr_results — cache, invalidated on new game
export const speculativePrResults = pgTable('speculative_pr_results', {
  id: serial('id').primaryKey(),
  sectionId: integer('section_id')
    .notNull()
    .references(() => sections.id),
  unitType: text('unit_type').notNull(),
  unitId: integer('unit_id').notNull(),
  nextDivision: text('next_division'),
  promotionStatus: text('promotion_status'),
  computedAt: timestamp('computed_at').notNull().defaultNow(),
});

// warning_acknowledgements
export const warningAcknowledgements = pgTable(
  'warning_acknowledgements',
  {
    id: serial('id').primaryKey(),
    eventId: integer('event_id')
      .notNull()
      .references(() => sections.id),
    warningCode: text('warning_code').notNull(),
    acknowledgedBy: integer('acknowledged_by').notNull(),
    acknowledgedAt: timestamp('acknowledged_at').notNull().defaultNow(),
  },
  (t) => ({ uniq: unique().on(t.eventId, t.warningCode) }),
);

// advancement_decisions
export const advancementDecisions = pgTable(
  'advancement_decisions',
  {
    id: serial('id').primaryKey(),
    sectionId: integer('section_id')
      .notNull()
      .references(() => sections.id),
    unitType: text('unit_type').notNull(),
    unitId: integer('unit_id').notNull(),
    advances: boolean('advances').notNull(),
    decidedAt: timestamp('decided_at').notNull().defaultNow(),
  },
  (t) => ({ uniq: unique().on(t.sectionId, t.unitType, t.unitId) }),
);

// dimension_states — computed division count after each event transition
export const dimensionStates = pgTable(
  'dimension_states',
  {
    id: serial('id').primaryKey(),
    eventId: integer('event_id')
      .notNull()
      .references(() => sections.id),
    dimensionAxis: text('dimension_axis').notNull(),
    activeDivisionCount: integer('active_division_count').notNull(),
    computedAt: timestamp('computed_at').notNull().defaultNow(),
  },
  (t) => ({ uniq: unique().on(t.eventId, t.dimensionAxis) }),
);
