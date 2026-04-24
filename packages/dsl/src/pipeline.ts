import * as yaml from 'yaml';
import { parseConfig } from './parser.js';
import { resolveConfig } from './resolver.js';
import { expandConfig } from './expander.js';
import { validateExpanded } from './validator.js';
import { checkSufficiency } from './sufficiency.js';
import type {
  PipelineResult,
  ExpandedConfig,
  ExpandedSection,
  SlotSource,
  ExpandedSlot,
  DeferredSlotGenerator,
  VariantInfo,
  Diagnostic,
  CapturePolicy,
  RegistrationPolicy,
  AggregationFunction,
} from './types.js';

// ---------------------------------------------------------------------------
// runPipeline
// ---------------------------------------------------------------------------

export async function runPipeline(
  yamlSource: string,
  variants: Map<number, VariantInfo>,
): Promise<PipelineResult> {
  const allDiags: Diagnostic[] = [];

  // Stage 1: parse
  const parseResult = parseConfig(yamlSource);
  allDiags.push(...parseResult.diagnostics);

  if (!parseResult.ok) {
    return {
      diagnostics: allDiags,
      hasErrors: true,
      hasWarnings: false,
      canSave: false,
      canPublish: false,
    };
  }

  // Stage 2: resolve
  const resolvedConfig = resolveConfig(parseResult);
  allDiags.push(...resolvedConfig.diagnostics.filter((d) => !parseResult.diagnostics.includes(d)));

  // Stage 3: expand
  const expandedConfig = expandConfig(resolvedConfig, variants);
  allDiags.push(...expandedConfig.diagnostics);

  const expandErrors = expandedConfig.diagnostics.filter((d) => d.severity === 'error');
  if (expandErrors.length > 0) {
    return {
      parseResult,
      resolvedConfig,
      expandedConfig,
      diagnostics: allDiags,
      hasErrors: true,
      hasWarnings: allDiags.some((d) => d.severity === 'warning'),
      canSave: false,
      canPublish: false,
    };
  }

  // Stage 4: validate (async)
  const validationDiags = await validateExpanded(expandedConfig);
  allDiags.push(...validationDiags);

  const validationErrors = validationDiags.filter((d) => d.severity === 'error');
  if (validationErrors.length > 0) {
    return {
      parseResult,
      resolvedConfig,
      expandedConfig,
      diagnostics: allDiags,
      hasErrors: true,
      hasWarnings: allDiags.some((d) => d.severity === 'warning'),
      canSave: false,
      canPublish: false,
    };
  }

  // Stage 5: sufficiency
  const sufficiencyDiags = checkSufficiency(expandedConfig);
  allDiags.push(...sufficiencyDiags);

  const hasErrors = allDiags.some((d) => d.severity === 'error');
  const hasWarnings = allDiags.some((d) => d.severity === 'warning');

  return {
    parseResult,
    resolvedConfig,
    expandedConfig,
    diagnostics: allDiags,
    hasErrors,
    hasWarnings,
    // canSave: no errors (warnings are acknowledable)
    canSave: !hasErrors,
    // canPublish: no errors AND no unacknowledged warnings
    canPublish: !hasErrors && !hasWarnings,
  };
}

// ---------------------------------------------------------------------------
// formatYaml
// ---------------------------------------------------------------------------

export function formatYaml(yamlStr: string): string {
  try {
    const parsed = yaml.parse(yamlStr);
    return yaml.stringify(parsed, { indent: 2 });
  } catch {
    return yamlStr;
  }
}

// ---------------------------------------------------------------------------
// serialiseConfig
// ---------------------------------------------------------------------------

const DEFAULT_CAPTURE_POLICY: CapturePolicy = { scrape: false, submit: true };
const DEFAULT_REGISTRATION_POLICY: RegistrationPolicy = {
  implicit: true,
  explicit: false,
  pool_units_allowed: false,
};

function isDefaultCapturePolicy(cp: CapturePolicy): boolean {
  return cp.scrape === DEFAULT_CAPTURE_POLICY.scrape &&
    cp.submit === DEFAULT_CAPTURE_POLICY.submit &&
    !cp.scrape_schedule &&
    !cp.transition;
}

function isDefaultRegistrationPolicy(rp: RegistrationPolicy): boolean {
  return rp.implicit === DEFAULT_REGISTRATION_POLICY.implicit &&
    !rp.explicit &&
    !rp.pool_units_allowed &&
    !rp.transition;
}

function isDerivedRanking(agg: AggregationFunction | undefined): boolean {
  return !!(agg && 'fn' in agg && (agg as { fn: string }).fn === 'derived_ranking');
}

function serialiseSlot(slot: SlotSource): unknown {
  if ('kind' in slot) {
    const deferred = slot as DeferredSlotGenerator;
    if (deferred.trigger_type === 'admin_sequence') {
      return {
        generator: 'sequence',
        count: 'admin',
        ...(deferred.generator_config as Record<string, unknown> ?? {}),
      };
    }
    return {
      generator: 'on_trigger',
      trigger: deferred.trigger_type,
      ...(deferred.generator_config as Record<string, unknown> ?? {}),
    };
  }

  const s = slot as ExpandedSlot;
  const out: Record<string, unknown> = {};
  if (s.seed_pattern) out.seed_pattern = s.seed_pattern;
  if (s.assignment_trigger) out.assignment_trigger = s.assignment_trigger;
  if (s.lazy_trigger) out.lazy_trigger = s.lazy_trigger;
  if (s.missing_score_default !== undefined) out.missing_score_default = s.missing_score_default;
  if (s.attempt_modifier) out.attempt_modifier = s.attempt_modifier;
  if (s.validity_rules?.length) out.validity_rules = s.validity_rules;
  if (s.time_window && (s.time_window.start || s.time_window.end)) {
    out.time_window = s.time_window;
  }
  return out;
}

function serialiseSection(section: ExpandedSection): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (section.name) out.name = section.name;
  if (section.slug) out.slug = section.slug;

  if (section.scoring_unit_type && section.scoring_unit_type !== 'individual') {
    out.scoring_unit_type = section.scoring_unit_type;
  }

  if (section.classification_rule) out.classification_rule = section.classification_rule;
  if (section.unit_attribution) out.unit_attribution = section.unit_attribution;
  if (section.aggregation_function) out.aggregation_function = section.aggregation_function;

  // non_participant_result: omit '"0"' unless derived_ranking
  if (section.non_participant_result && section.non_participant_result !== '"0"') {
    out.non_participant_result = section.non_participant_result;
  } else if (isDerivedRanking(section.aggregation_function) && section.non_participant_result) {
    out.non_participant_result = section.non_participant_result;
  }

  // time_window: omit empty
  if (section.time_window && (section.time_window.start || section.time_window.end)) {
    out.time_window = section.time_window;
  }

  // capture_policy: omit defaults
  if (section.capture_policy && !isDefaultCapturePolicy(section.capture_policy)) {
    out.capture_policy = section.capture_policy;
  }

  // registration_policy: omit defaults
  if (section.registration_policy && !isDefaultRegistrationPolicy(section.registration_policy)) {
    out.registration_policy = section.registration_policy;
  }

  // visibility_policy: omit empty
  if (section.visibility_policy &&
    (section.visibility_policy.results_visible !== undefined ||
      section.visibility_policy.specs_visible !== undefined)) {
    out.visibility_policy = section.visibility_policy;
  }

  if (section.conditional_activation) out.conditional_activation = section.conditional_activation;
  if (section.advancement) out.advancement = section.advancement;

  // matchmaking: omit type:none
  if (section.matchmaking && section.matchmaking.type !== 'none') {
    out.matchmaking = section.matchmaking;
  }

  // awards: strip when:'"true"'
  if (section.awards.length > 0) {
    out.awards = section.awards.map((a) => {
      const { when, ...rest } = a;
      return when === '"true"' ? rest : { ...rest, when };
    });
  }

  // scoreboards: strip row_style.when:'"true"'
  if (section.scoreboards.length > 0) {
    out.scoreboards = section.scoreboards.map((sb) => ({
      ...sb,
      row_styles: sb.row_styles?.map((rs) => {
        const { when, ...rest } = rs;
        return when === '"true"' ? rest : { ...rest, when };
      }),
    }));
  }

  if (section.routing) out.routing = section.routing;

  // root-only fields
  if (section.organisers?.length) out.organisers = section.organisers;
  if (section.dimensions?.length) out.dimensions = section.dimensions;
  if (section.absence_policy) out.absence_policy = section.absence_policy;
  if (section.promotion_relegation) out.promotion_relegation = section.promotion_relegation;

  // child sections
  if (section.sections.length > 0) {
    out.sections = section.sections.map(serialiseSection);
  }

  // slots
  if (section.slots.length > 0) {
    out.slots = section.slots.map(serialiseSlot);
  }

  return out;
}

export function serialiseConfig(config: ExpandedConfig): string {
  const root = config.root;
  const eventObj = serialiseSection(root);

  // Root-level: name and slug come from the event definition
  const rawConfig: Record<string, unknown> = { event: eventObj };

  return yaml.stringify(rawConfig, { indent: 2 });
}
