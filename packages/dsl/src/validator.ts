import type {
  ExpandedConfig,
  ExpandedSection,
  SlotSource,
  ExpandedSlot,
  Diagnostic,
  RoutingRule,
  ColourToken,
} from './types.js';
import { fetchMaterialIconNames } from './lib/materialIcons.js';

// ---------------------------------------------------------------------------
// Valid colour tokens
// ---------------------------------------------------------------------------

const VALID_COLOUR_TOKENS = new Set<string>([
  // Sequential
  'diamond', 'platinum', 'gold', 'silver', 'bronze', 'iron', 'ash',
  // Semantic
  'pos-2', 'pos-1', 'mid', 'neg-1', 'neg-2',
  // Hue — green
  'green-0', 'green-1', 'green-2', 'green-3', 'green-4',
  'green-5', 'green-6', 'green-7', 'green-8', 'green-9',
  // Hue — blue
  'blue-0', 'blue-1', 'blue-2', 'blue-3', 'blue-4',
  'blue-5', 'blue-6', 'blue-7', 'blue-8', 'blue-9',
  // Hue — magenta
  'magenta-0', 'magenta-1', 'magenta-2', 'magenta-3', 'magenta-4',
  'magenta-5', 'magenta-6', 'magenta-7', 'magenta-8', 'magenta-9',
]);

// ---------------------------------------------------------------------------
// Structural boolean fields (must be boolean, not string)
// ---------------------------------------------------------------------------

const STRUCTURAL_BOOL_PATHS = [
  'capture_policy.scrape',
  'capture_policy.submit',
  'registration_policy.implicit',
  'registration_policy.explicit',
  'registration_policy.pool_units_allowed',
  'promotion_relegation.clamp',
] as const;

// Expression fields (must be string, not boolean)
const EXPRESSION_FIELDS = new Set([
  'conditional_activation',
  'classification_rule',
  'non_participant_result',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function err(code: string, message: string, path?: string): Diagnostic {
  return { code, severity: 'error', message, path };
}

function warn(code: string, message: string, path?: string): Diagnostic {
  return { code, severity: 'warning', message, path };
}

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function routingRuleKind(rule: unknown): string {
  if (!rule || typeof rule !== 'object') return 'unknown';
  const r = rule as Record<string, unknown>;
  if ('proceeds_to' in r) return 'proceeds_to';
  if ('eliminated' in r) return 'eliminated';
  if ('assigned_to' in r) return 'assigned_to';
  if ('assigned_rank' in r) return 'assigned_rank';
  if ('when' in r) return 'when';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Walk a section tree and collect all icons
// ---------------------------------------------------------------------------

function collectIcons(section: ExpandedSection, out: string[]) {
  for (const award of section.awards) {
    if (award.badge?.icon) out.push(award.badge.icon);
  }
  for (const child of section.sections) {
    collectIcons(child, out);
  }
}

// ---------------------------------------------------------------------------
// Per-section structural checks
// ---------------------------------------------------------------------------

function checkSection(
  section: ExpandedSection,
  isRoot: boolean,
  parent: ExpandedSection | null,
  diags: Diagnostic[],
  path: string,
) {
  // sections_and_slots_conflict
  if (section.sections.length > 0 && section.slots.length > 0) {
    diags.push(err('sections_and_slots_conflict',
      `Section "${section.name}" has both child sections and slots`, path));
  }

  // routing_on_non_leaf
  if (section.routing && section.section_type !== 'leaf') {
    diags.push(err('routing_on_non_leaf',
      `Section "${section.name}" is a branch/root but has routing`, path));
  }

  // conditional_activation_on_root
  if (isRoot && section.conditional_activation) {
    diags.push(err('conditional_activation_on_root',
      'Root section cannot have conditional_activation', path));
  }

  // root_only_field_on_non_root
  if (!isRoot) {
    if (section.dimensions) {
      diags.push(err('root_only_field_on_non_root',
        `"dimensions" is only allowed on the root event section`, `${path}.dimensions`));
    }
    if (section.absence_policy) {
      diags.push(err('root_only_field_on_non_root',
        `"absence_policy" is only allowed on the root event section`, `${path}.absence_policy`));
    }
    if (section.promotion_relegation) {
      diags.push(err('root_only_field_on_non_root',
        `"promotion_relegation" is only allowed on the root event section`, `${path}.promotion_relegation`));
    }
  }

  // scrape_with_admin_window
  if (section.capture_policy?.scrape === true) {
    const tw = section.time_window;
    if (tw?.start === 'admin' || tw?.end === 'admin') {
      diags.push(err('scrape_with_admin_window',
        `Section "${section.name}": scrape:true is incompatible with admin time_window`, path));
    }
  }

  // missing_classification_rule — only applies to leaf sections (branch sections derive type from children)
  if (section.section_type === 'leaf' && section.scoring_unit_type === 'inferred' && !section.classification_rule) {
    diags.push(err('missing_classification_rule',
      `Section "${section.name}": scoring_unit_type "inferred" requires classification_rule`, path));
  }

  // missing_unit_attribution
  if (parent && parent.section_type === 'branch' && parent.aggregation_function) {
    if (parent.scoring_unit_type !== section.scoring_unit_type && !section.unit_attribution) {
      diags.push(err('missing_unit_attribution',
        `Section "${section.name}": unit type differs from parent but unit_attribution is missing`, path));
    }
  }

  // elimination_bracket_removed
  if (section.aggregation_function && 'fn' in section.aggregation_function) {
    if ((section.aggregation_function as { fn: string }).fn === 'elimination_bracket') {
      diags.push(err('elimination_bracket_removed',
        `Section "${section.name}": elimination_bracket aggregation has been removed`, path));
    }
  }

  // primary_scoreboard_count — per section: should have at most one primary
  const primaryCount = section.scoreboards.filter((s) => s.primary).length;
  if (section.scoreboards.length > 0 && primaryCount === 0) {
    diags.push(err('primary_scoreboard_count',
      `Section "${section.name}": no scoreboard is marked primary:true`, path));
  }
  if (primaryCount > 1) {
    diags.push(err('primary_scoreboard_count',
      `Section "${section.name}": more than one scoreboard is marked primary:true`, path));
  }

  // unknown_colour_token — in awards badges
  for (const award of section.awards) {
    if (award.badge?.colour && !VALID_COLOUR_TOKENS.has(award.badge.colour as string)) {
      diags.push(err('unknown_colour_token',
        `Award "${award.name}": unknown colour token "${award.badge.colour}"`,
        `${path}.awards`));
    }
  }

  // unknown_colour_token — in scoreboard row_styles
  for (const sb of section.scoreboards) {
    for (const rs of sb.row_styles ?? []) {
      if (rs.accent && !VALID_COLOUR_TOKENS.has(rs.accent as string)) {
        diags.push(err('unknown_colour_token',
          `Scoreboard "${sb.name}" row style "${rs.label}": unknown colour token "${rs.accent}"`,
          `${path}.scoreboards`));
      }
    }
  }

  // row_style_missing_label
  for (const sb of section.scoreboards) {
    for (const rs of sb.row_styles ?? []) {
      if (!rs.label) {
        diags.push(err('row_style_missing_label',
          `Scoreboard "${sb.name}" has a row style without a label`,
          `${path}.scoreboards`));
      }
    }
  }

  // string_on_structural_bool — check runtime types
  for (const fieldPath of STRUCTURAL_BOOL_PATHS) {
    const val = getNestedValue(section, fieldPath);
    if (typeof val === 'string') {
      diags.push(err('string_on_structural_bool',
        `"${fieldPath}" should be a boolean but got a string "${val}"`,
        `${path}.${fieldPath}`));
    }
  }

  // bool_on_expression_field
  for (const field of EXPRESSION_FIELDS) {
    const val = (section as unknown as Record<string, unknown>)[field];
    if (typeof val === 'boolean') {
      diags.push(err('bool_on_expression_field',
        `"${field}" should be a string expression but got a boolean`,
        `${path}.${field}`));
    }
  }
  // Also check award predicates and routing when fields
  for (const award of section.awards) {
    if (typeof award.predicate === 'boolean') {
      diags.push(err('bool_on_expression_field',
        `Award "${award.name}" predicate should be a string expression but got a boolean`,
        `${path}.awards`));
    }
    if (typeof award.when === 'boolean') {
      diags.push(err('bool_on_expression_field',
        `Award "${award.name}" when should be a string expression but got a boolean`,
        `${path}.awards`));
    }
  }

  // compile_time_expr_invalid — check for unresolved ${...} with dotted access
  checkUnresolvedExprs(section, path, diags);

  // incompatible_routing_branches
  if (section.routing) {
    for (const [rankKey, rule] of Object.entries(section.routing)) {
      checkRoutingBranches(rule, `${path}.routing.${rankKey}`, diags);
    }
  }

  // Check slots
  for (const slot of section.slots) {
    if ('kind' in slot) continue; // DeferredSlotGenerator
    checkSlot(slot as ExpandedSlot, path, diags);
  }

  // Recurse
  for (let i = 0; i < section.sections.length; i++) {
    checkSection(section.sections[i]!, false, section, diags, `${path}.sections[${i}]`);
  }
}

function checkSlot(slot: ExpandedSlot, parentPath: string, diags: Diagnostic[]) {
  // aggregation_on_slot
  if ('aggregation_function' in (slot as unknown as Record<string, unknown>)) {
    diags.push(err('aggregation_on_slot',
      'Slot has aggregation_function — aggregation is only valid on sections',
      parentPath));
  }

  // lazy_trigger_missing
  if (slot.assignment_trigger === 'lazy' && !slot.lazy_trigger) {
    diags.push(err('lazy_trigger_missing',
      'Slot has assignment_trigger: lazy but no lazy_trigger specified',
      parentPath));
  }

  // string_on_structural_bool — attempt_modifier.enabled
  const attemptEnabled = (slot as unknown as Record<string, unknown>).attempt_modifier;
  if (attemptEnabled && typeof (attemptEnabled as Record<string, unknown>).enabled === 'string') {
    diags.push(err('string_on_structural_bool',
      '"attempt_modifier.enabled" should be a boolean but got a string',
      parentPath));
  }
}

function checkUnresolvedExprs(section: ExpandedSection, path: string, diags: Diagnostic[]) {
  // Check seed patterns for unresolved ${expr} with dotted paths
  const unresolved = /\$\{[^}]*\.[^}]*\}/;
  for (const slot of section.slots) {
    if ('kind' in slot) continue;
    const s = slot as ExpandedSlot;
    if (s.seed_pattern && unresolved.test(s.seed_pattern)) {
      diags.push(err('compile_time_expr_invalid',
        `Seed pattern "${s.seed_pattern}" contains a runtime expression that cannot be evaluated at compile time`,
        `${path}.slots`));
    }
  }
}

function checkRoutingBranches(rule: RoutingRule, path: string, diags: Diagnostic[]) {
  if (!rule || typeof rule !== 'object') return;
  const r = rule as Record<string, unknown>;
  if ('when' in r && 'otherwise' in r && r.otherwise) {
    // The 'then' action is determined by the fields of this rule (excluding 'when' and 'otherwise')
    let thenKind = 'unknown';
    if ('proceeds_to' in r) thenKind = 'proceeds_to';
    else if ('assigned_rank' in r) thenKind = 'assigned_rank';
    else if ('assigned_to' in r) thenKind = 'assigned_to';
    else if ('eliminated' in r) thenKind = 'eliminated';

    const otherwiseKind = routingRuleKind(r.otherwise);
    if (thenKind !== otherwiseKind && thenKind !== 'unknown' && otherwiseKind !== 'unknown') {
      diags.push(err('incompatible_routing_branches',
        `Routing at ${path}: when branch type "${thenKind}" differs from otherwise branch type "${otherwiseKind}"`,
        path));
    }
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function validateExpanded(
  config: ExpandedConfig,
  _lineMap?: number[],
): Promise<Diagnostic[]> {
  const diags: Diagnostic[] = [];

  // Walk section tree
  checkSection(config.root, true, null, diags, 'event');

  // Material Icons validation (async)
  const iconRefs: string[] = [];
  collectIcons(config.root, iconRefs);

  if (iconRefs.length > 0) {
    const validIcons = await fetchMaterialIconNames();
    const iconAvailable = validIcons.size > 0;
    for (const icon of iconRefs) {
      if (!validIcons.has(icon)) {
        if (iconAvailable) {
          diags.push(err('invalid_material_icon',
            `Icon "${icon}" is not a valid Material Icons name`));
        } else {
          diags.push(warn('invalid_material_icon',
            `Icon "${icon}" could not be validated (Material Icons API unavailable)`));
        }
      }
    }
  }

  return diags;
}
