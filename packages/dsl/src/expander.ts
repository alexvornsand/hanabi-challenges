import type {
  ResolvedConfig,
  ResolvedSection,
  ExpandedConfig,
  ExpandedSection,
  SlotSource,
  ExpandedSlot,
  DeferredSlotGenerator,
  SlotConfig,
  GeneratorCall,
  RawSection,
  VariantInfo,
  Diagnostic,
  TimeWindow,
  CapturePolicy,
  RegistrationPolicy,
  VisibilityPolicy,
  Matchmaking,
  Award,
  Scoreboard,
  RoutingBlock,
  AggregationFunction,
  Advancement,
} from './types.js';
import { interpolate } from './compileTimeEval.js';
import type { CompileTimeEnv } from './compileTimeEval.js';
import { singleElimination, doubleElimination, stepladder, roundRobin } from './generators/brackets.js';
import type { BracketParams, RoundRobinParams } from './generators/brackets.js';

const diagnostics: Diagnostic[] = [];

function addError(code: string, message: string, path?: string) {
  diagnostics.push({ code, severity: 'error', message, path });
}
function addWarning(code: string, message: string, path?: string) {
  diagnostics.push({ code, severity: 'warning', message, path });
}

// ---------------------------------------------------------------------------
// Interpolate all string values in an object tree
// ---------------------------------------------------------------------------

/**
 * Substitute `{varName}` placeholders for loop variables (i, index, item).
 * These are distinct from runtime seed engine variables ({eventID} etc.).
 * Only replaces keys that are present in env and have a primitive value.
 */
function applyLoopVars(str: string, env: CompileTimeEnv): string {
  return str.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (match, name: string) => {
    const val = env[name];
    if (val === undefined || typeof val === 'function' || typeof val === 'object') return match;
    return String(val);
  });
}

function interpolateStrings(obj: unknown, env: CompileTimeEnv): unknown {
  if (typeof obj === 'string') {
    // First substitute {varName} loop variables (e.g. {i}, {index})
    const afterLoop = applyLoopVars(obj, env);
    // Then process ${expr} compile-time expressions
    if (!afterLoop.includes('$')) return afterLoop;
    const result = interpolate(afterLoop, env);
    if (!result.ok) {
      addError('compile_time_expr_invalid', result.message);
      return afterLoop;
    }
    return result.value;
  }
  if (Array.isArray(obj)) return obj.map((item) => interpolateStrings(item, env));
  if (obj !== null && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = interpolateStrings(v, env);
    }
    return out;
  }
  return obj;
}

// ---------------------------------------------------------------------------
// Collect section names from a section tree
// ---------------------------------------------------------------------------

function collectSectionNames(section: ExpandedSection | RawSection, names: Set<string>) {
  if (section.name) names.add(section.name);
  const secs = (section as ExpandedSection).sections ?? (section as RawSection).sections ?? [];
  for (const child of secs) {
    if ('generator' in (child as object)) continue;
    collectSectionNames(child as ExpandedSection, names);
  }
}

// ---------------------------------------------------------------------------
// Validate routing targets
// ---------------------------------------------------------------------------

function validateRouting(routing: RoutingBlock | undefined, sectionNames: Set<string>) {
  if (!routing) return;
  for (const [, rule] of Object.entries(routing)) {
    validateRoutingRule(rule, sectionNames);
  }
}

function validateRoutingRule(rule: unknown, sectionNames: Set<string>) {
  if (!rule || typeof rule !== 'object') return;
  const r = rule as Record<string, unknown>;
  if ('proceeds_to' in r && typeof r.proceeds_to === 'string') {
    if (!sectionNames.has(r.proceeds_to as string)) {
      addError('unresolved_reference', `Routing target "${r.proceeds_to}" does not reference a known section`);
    }
  }
  if ('assigned_to' in r && r.assigned_to && typeof r.assigned_to === 'object') {
    const at = r.assigned_to as { section?: string };
    if (at.section && !sectionNames.has(at.section)) {
      addError('unresolved_reference', `Routing target section "${at.section}" does not reference a known section`);
    }
  }
  if ('otherwise' in r) validateRoutingRule(r.otherwise, sectionNames);
  if ('when' in r) {
    // Nested rule
    validateRoutingRule({ ...(r as Record<string, unknown>), when: undefined }, sectionNames);
  }
}

// ---------------------------------------------------------------------------
// isGeneratorCall
// ---------------------------------------------------------------------------

function isGeneratorCall(item: unknown): item is GeneratorCall {
  return !!(item && typeof item === 'object' && 'generator' in (item as object));
}

// ---------------------------------------------------------------------------
// Expand slots from a list
// ---------------------------------------------------------------------------

function expandSlots(
  rawSlots: Array<SlotConfig | GeneratorCall> | undefined,
  generators: Record<string, unknown>,
  env: CompileTimeEnv,
  parentPath: string,
): { slots: SlotSource[]; hadOnTrigger: boolean } {
  if (!rawSlots) return { slots: [], hadOnTrigger: false };

  const slots: SlotSource[] = [];
  let slotIndex = 1;
  let hadOnTrigger = false;
  let position = 0;

  for (const rawSlot of rawSlots) {
    if (isGeneratorCall(rawSlot)) {
      const genName = rawSlot.generator;
      const genArgs = { ...rawSlot } as Record<string, unknown>;
      delete genArgs.generator;

      // Check for explicit items after on_trigger
      if (hadOnTrigger) {
        addError('explicit_item_after_on_trigger',
          `Items after on_trigger in ${parentPath} are not allowed`);
      }

      // Built-in combinators
      if (genName === 'sequence') {
        const count = genArgs.count ?? genArgs.n;
        if (count === 'admin') {
          slots.push({
            kind: 'deferred',
            trigger_type: 'admin_sequence',
            generator_config: genArgs,
            position: position++,
          } as DeferredSlotGenerator);
          hadOnTrigger = true;
        } else {
          const n = typeof count === 'number' ? count : 1;
          for (let i = 1; i <= n; i++) {
            const loopEnv = { ...env, i, index: i };
            const slotTemplate = genArgs.slot ?? genArgs.template ?? {};
            const expandedSlot = interpolateStrings(slotTemplate, loopEnv) as SlotConfig;
            const seedPattern = expandedSlot.seed_pattern ?? (genArgs.seed_pattern as string) ?? '';
            slots.push({
              ...expandedSlot,
              seed_pattern: seedPattern,
              slot_index: slotIndex++,
            } as ExpandedSlot);
          }
        }
      } else if (genName === 'on_trigger') {
        const trigger = genArgs.trigger as string;
        let triggerType: DeferredSlotGenerator['trigger_type'] = 'admin_sequence';
        if (trigger === 'attempt_start') triggerType = 'attempt_start';
        else if (trigger === 'bracket_activation') triggerType = 'bracket_activation';
        else if (trigger === 'admin') triggerType = 'admin_sequence';

        slots.push({
          kind: 'deferred',
          trigger_type: triggerType,
          generator_config: genArgs,
          position: position++,
        } as DeferredSlotGenerator);
        hadOnTrigger = true;
      } else if (genName === 'for_each') {
        const inList = genArgs.in;
        if (!Array.isArray(inList)) {
          addError('compile_time_expr_invalid', `for_each(in: ...) requires a list`);
          continue;
        }
        const slotTemplate = genArgs.slot ?? genArgs.template ?? {};
        for (const item of inList) {
          const loopEnv = { ...env, item };
          const expanded = interpolateStrings(slotTemplate, loopEnv) as SlotConfig;
          const seedPattern = expanded.seed_pattern ?? (genArgs.seed_pattern as string) ?? '';
          slots.push({
            ...expanded,
            seed_pattern: seedPattern,
            slot_index: slotIndex++,
          } as ExpandedSlot);
        }
      } else if (genName === 'compose') {
        const items = genArgs.items;
        if (!Array.isArray(items)) {
          addError('compile_time_expr_invalid', `compose(items: ...) requires a list`);
          continue;
        }
        const { slots: innerSlots } = expandSlots(items as Array<SlotConfig | GeneratorCall>, generators, env, parentPath);
        slots.push(...innerSlots);
        slotIndex += innerSlots.length;
      } else {
        // User-defined generator
        const genDef = generators[genName];
        if (!genDef) {
          addError('unresolved_reference', `Unknown generator: ${genName}`);
          continue;
        }
        // Simplified: treat as single slot with seed_pattern from generator
        const merged = { ...genArgs } as SlotConfig;
        slots.push({
          ...merged,
          seed_pattern: merged.seed_pattern ?? '',
          slot_index: slotIndex++,
        } as ExpandedSlot);
      }
    } else {
      // Explicit slot
      if (hadOnTrigger) {
        addError('explicit_item_after_on_trigger',
          `Explicit slot after on_trigger in ${parentPath}`);
      }
      const slot = interpolateStrings(rawSlot, env) as SlotConfig;
      slots.push({
        ...slot,
        seed_pattern: slot.seed_pattern ?? '',
        slot_index: slotIndex++,
      } as ExpandedSlot);
    }
  }

  return { slots, hadOnTrigger };
}

// ---------------------------------------------------------------------------
// Bracket generator dispatch
// ---------------------------------------------------------------------------

function expandBracketGenerator(
  genName: string,
  genArgs: Record<string, unknown>,
): ExpandedSection[] | null {
  const unitCount = (genArgs.unit_count as number | undefined) ?? 8;
  const params: BracketParams = {
    match_comparators: (genArgs.match_comparators as BracketParams['match_comparators']) ?? [],
    slots: (genArgs.slots as number | string | undefined) ?? 1,
    assignment: (genArgs.assignment as BracketParams['assignment']) ?? 'dynamic',
  };

  switch (genName) {
    case 'single_elimination':
      return singleElimination(params, unitCount);
    case 'double_elimination':
      return doubleElimination(params, unitCount);
    case 'stepladder':
      return stepladder(params, unitCount);
    case 'round_robin': {
      const rrParams: RoundRobinParams = {
        ...params,
        win_points: genArgs.win_points as number | undefined,
        draw_points: genArgs.draw_points as number | undefined,
        loss_points: genArgs.loss_points as number | undefined,
        tiebreakers: genArgs.tiebreakers as string[] | undefined,
      };
      return roundRobin(rrParams, unitCount);
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Expand a single section recursively
// ---------------------------------------------------------------------------

function expandSection(
  section: ResolvedSection,
  generators: Record<string, unknown>,
  env: CompileTimeEnv,
  position: number,
  sectionNames: Set<string>,
): ExpandedSection {
  // Interpolate string fields
  const interpolated = interpolateStrings(section, env) as ResolvedSection;

  // Determine section type: branch if has subsections, leaf otherwise
  const hasSections =
    Array.isArray(interpolated.sections) && interpolated.sections.length > 0;
  const section_type: 'leaf' | 'branch' = hasSections ? 'branch' : 'leaf';

  // Expand child sections
  const expandedSections: ExpandedSection[] = [];
  if (Array.isArray(interpolated.sections)) {
    let childPos = 0;
    for (const child of interpolated.sections) {
      if (isGeneratorCall(child)) {
        const genName = (child as Record<string, unknown>).generator as string;
        const genArgs = { ...(child as Record<string, unknown>) };
        delete genArgs.generator;

        const bracketSections = expandBracketGenerator(genName, genArgs);
        if (bracketSections) {
          for (const bs of bracketSections) {
            expandedSections.push({ ...bs, position: childPos++ });
          }
        }
        // Unknown section generators are silently skipped
        continue;
      }
      expandedSections.push(
        expandSection(
          child as ResolvedSection,
          generators,
          env,
          childPos++,
          sectionNames,
        ),
      );
    }
  }

  // Expand slots
  const { slots } = expandSlots(
    interpolated.slots as Array<SlotConfig | GeneratorCall> | undefined,
    generators,
    env,
    interpolated.name ?? 'section',
  );

  // Validate routing
  validateRouting(interpolated.routing as RoutingBlock | undefined, sectionNames);

  return {
    name: interpolated.name ?? 'Unnamed',
    position,
    section_type,
    scoring_unit_type: (interpolated.scoring_unit_type ?? 'individual') as 'individual' | 'team' | 'inferred',
    classification_rule: interpolated.classification_rule,
    unit_attribution: interpolated.unit_attribution,
    aggregation_function: interpolated.aggregation_function as AggregationFunction | undefined,
    non_participant_result: interpolated.non_participant_result ?? '"0"',
    time_window: (interpolated.time_window ?? {}) as TimeWindow,
    capture_policy: (interpolated.capture_policy ?? { scrape: false, submit: true }) as CapturePolicy,
    registration_policy: (interpolated.registration_policy ?? { implicit: true }) as RegistrationPolicy,
    visibility_policy: (interpolated.visibility_policy ?? {}) as VisibilityPolicy,
    conditional_activation: interpolated.conditional_activation,
    advancement: interpolated.advancement as Advancement | undefined,
    matchmaking: (interpolated.matchmaking ?? { type: 'none' }) as Matchmaking,
    awards: (interpolated.awards ?? []) as Award[],
    scoreboards: (interpolated.scoreboards ?? []) as Scoreboard[],
    routing: interpolated.routing as RoutingBlock | undefined,
    sections: expandedSections,
    slots,
    ...(interpolated.organisers ? { organisers: interpolated.organisers } : {}),
    ...(interpolated.dimensions ? { dimensions: interpolated.dimensions } : {}),
    ...(interpolated.absence_policy ? { absence_policy: interpolated.absence_policy } : {}),
    ...(interpolated.promotion_relegation ? { promotion_relegation: interpolated.promotion_relegation } : {}),
  };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function expandConfig(
  resolved: ResolvedConfig,
  _variants: Map<number, VariantInfo>,
): ExpandedConfig {
  // Reset diagnostics for this call
  diagnostics.length = 0;

  const generators = resolved.raw.generators ?? {};
  const env: CompileTimeEnv = {};

  // Collect all section names first (for routing validation)
  const sectionNames = new Set<string>();
  collectSectionNames(resolved.resolved as unknown as RawSection, sectionNames);

  const root = expandSection(
    resolved.resolved,
    generators as Record<string, unknown>,
    env,
    0,
    sectionNames,
  );

  return {
    root,
    diagnostics: [...diagnostics],
  };
}
