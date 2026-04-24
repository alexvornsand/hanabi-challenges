import type {
  ParseResult,
  ResolvedConfig,
  ResolvedSection,
  RawSection,
  TimeWindow,
  CapturePolicy,
  RegistrationPolicy,
  VisibilityPolicy,
  AggregationFunction,
} from './types.js';

// ---------------------------------------------------------------------------
// Defaults (used only when no ancestor supplies a value)
// ---------------------------------------------------------------------------

const DEFAULT_TIME_WINDOW: TimeWindow = {};
const DEFAULT_CAPTURE_POLICY: CapturePolicy = { scrape: false, submit: true };
const DEFAULT_REGISTRATION_POLICY: RegistrationPolicy = {
  implicit: true,
  explicit: false,
  pool_units_allowed: false,
};
const DEFAULT_VISIBILITY_POLICY: VisibilityPolicy = {
  results_visible: '"true"',
  specs_visible: '"true"',
};
const DEFAULT_NON_PARTICIPANT_RESULT = '"0"';
const DEFAULT_SCORING_UNIT_TYPE = 'individual' as const;

// ---------------------------------------------------------------------------
// isDerivedRanking
// ---------------------------------------------------------------------------

function isDerivedRanking(agg: AggregationFunction | undefined): boolean {
  return !!(agg && 'fn' in agg && agg.fn === 'derived_ranking');
}

// ---------------------------------------------------------------------------
// Inherited context — the values flowing down from ancestor to child
// ---------------------------------------------------------------------------

interface InheritedContext {
  time_window: TimeWindow;
  capture_policy: CapturePolicy;
  registration_policy: RegistrationPolicy;
  visibility_policy: VisibilityPolicy;
  non_participant_result: string;
  scoring_unit_type: 'individual' | 'team' | 'inferred';
}

function makeRootContext(): InheritedContext {
  return {
    time_window: DEFAULT_TIME_WINDOW,
    capture_policy: DEFAULT_CAPTURE_POLICY,
    registration_policy: DEFAULT_REGISTRATION_POLICY,
    visibility_policy: DEFAULT_VISIBILITY_POLICY,
    non_participant_result: DEFAULT_NON_PARTICIPANT_RESULT,
    scoring_unit_type: DEFAULT_SCORING_UNIT_TYPE,
  };
}

/**
 * Build an updated context from a section that has already had its own fields merged.
 * If the section explicitly declares a field, it becomes the new inherited value for children.
 * Otherwise the parent context value continues to flow down.
 */
function updateContext(section: RawSection, parentCtx: InheritedContext): InheritedContext {
  const nonParticipantResult = isDerivedRanking(section.aggregation_function)
    ? '"unit.parent_score"'
    : undefined;

  return {
    time_window: section.time_window ?? parentCtx.time_window,
    capture_policy: section.capture_policy ?? parentCtx.capture_policy,
    registration_policy: section.registration_policy ?? parentCtx.registration_policy,
    visibility_policy: section.visibility_policy ?? parentCtx.visibility_policy,
    non_participant_result:
      section.non_participant_result ?? nonParticipantResult ?? parentCtx.non_participant_result,
    scoring_unit_type: section.scoring_unit_type ?? parentCtx.scoring_unit_type,
  };
}

// ---------------------------------------------------------------------------
// applyWhenDefaults — normalise award/row_style `when` field
// ---------------------------------------------------------------------------

function applyWhenDefaults(section: RawSection): RawSection {
  return {
    ...section,
    awards: section.awards?.map((a) => ({
      ...a,
      when: a.when ?? '"true"',
    })),
  };
}

// ---------------------------------------------------------------------------
// resolveSection — depth-first
// ---------------------------------------------------------------------------

function resolveSection(section: RawSection, ctx: InheritedContext): ResolvedSection {
  // Normalise when defaults first
  const normalised = applyWhenDefaults(section);

  // Determine this section's own non_participant_result override
  const ownNonParticipant = isDerivedRanking(section.aggregation_function)
    ? '"unit.parent_score"'
    : undefined;

  // Build the resolved section — fill inheritable fields from context when not locally set
  const resolved: ResolvedSection = {
    ...normalised,
    time_window: normalised.time_window ?? ctx.time_window,
    capture_policy: normalised.capture_policy ?? ctx.capture_policy,
    registration_policy: normalised.registration_policy ?? ctx.registration_policy,
    visibility_policy: normalised.visibility_policy ?? ctx.visibility_policy,
    non_participant_result:
      normalised.non_participant_result ?? ownNonParticipant ?? ctx.non_participant_result,
    scoring_unit_type: normalised.scoring_unit_type ?? ctx.scoring_unit_type,
  };

  // Build the context to pass to children (using this section's explicit values)
  const childCtx = updateContext(section, ctx);

  // Recursively resolve child sections
  if (Array.isArray(resolved.sections)) {
    resolved.sections = resolved.sections.map((child) => {
      if ('generator' in (child as object)) return child; // GeneratorCall — skip
      return resolveSection(child as RawSection, childCtx);
    }) as ResolvedSection['sections'];
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function resolveConfig(parseResult: ParseResult): ResolvedConfig {
  const raw = parseResult.raw;
  const rootCtx = makeRootContext();
  const resolved = resolveSection(raw.event as RawSection, rootCtx);

  return {
    raw,
    resolved,
    diagnostics: parseResult.diagnostics,
  };
}
