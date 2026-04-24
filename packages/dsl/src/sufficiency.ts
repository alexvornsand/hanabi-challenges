import type {
  ExpandedConfig,
  ExpandedSection,
  ExpandedSlot,
  SlotSource,
  Diagnostic,
  Matchmaking,
} from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function notice(code: string, message: string, path?: string): Diagnostic {
  return { code, severity: 'notice', message, path };
}

function warn(code: string, message: string, path?: string): Diagnostic {
  return { code, severity: 'warning', message, path };
}

// Collect all leaf ExpandedSlot objects recursively
function collectSlots(section: ExpandedSection, out: ExpandedSlot[]) {
  for (const slot of section.slots) {
    if (!('kind' in slot)) out.push(slot as ExpandedSlot);
  }
  for (const child of section.sections) {
    collectSlots(child, out);
  }
}

// Collect all ExpandedSections recursively (including root)
function collectSections(section: ExpandedSection, out: ExpandedSection[]) {
  out.push(section);
  for (const child of section.sections) {
    collectSections(child, out);
  }
}

// Check if a seed pattern contains any of the given variable tags: {tag} or {tag*}
function patternHasVar(pattern: string, tag: string): boolean {
  return pattern.includes(`{${tag}}`) || pattern.includes(`{${tag}*}`);
}

// Check for 'admin' sentinel values in a section tree (for admin_input_required notice)
function collectAdminFields(section: ExpandedSection, path: string, out: Diagnostic[]) {
  // time_window
  if (section.time_window?.start === 'admin') {
    out.push(notice('admin_input_required',
      `time_window.start requires admin input`, `${path}.time_window.start`));
  }
  if (section.time_window?.end === 'admin') {
    out.push(notice('admin_input_required',
      `time_window.end requires admin input`, `${path}.time_window.end`));
  }

  // advancement
  if (section.advancement?.predicate === 'admin') {
    out.push(notice('admin_input_required',
      `advancement.predicate requires admin input`, `${path}.advancement.predicate`));
  }

  // matchmaking
  const mm = section.matchmaking as Matchmaking & { assignment?: unknown };
  if (mm?.assignment === 'admin') {
    out.push(notice('admin_input_required',
      `matchmaking.assignment requires admin input`, `${path}.matchmaking.assignment`));
  }

  // slots
  for (let i = 0; i < section.slots.length; i++) {
    const slot = section.slots[i] as SlotSource;
    if ('kind' in slot) continue;
    const s = slot as ExpandedSlot;
    if (s.lazy_trigger === 'admin') {
      out.push(notice('admin_input_required',
        `slot.lazy_trigger requires admin input`, `${path}.slots[${i}].lazy_trigger`));
    }
    if (s.time_window?.start === 'admin') {
      out.push(notice('admin_input_required',
        `slot.time_window.start requires admin input`, `${path}.slots[${i}].time_window.start`));
    }
    if (s.time_window?.end === 'admin') {
      out.push(notice('admin_input_required',
        `slot.time_window.end requires admin input`, `${path}.slots[${i}].time_window.end`));
    }
    if (s.attempt_modifier && (s.attempt_modifier as { count?: unknown }).count === 'admin') {
      out.push(notice('admin_input_required',
        `attempt_modifier.count requires admin input`, `${path}.slots[${i}].attempt_modifier.count`));
    }
  }

  // recurse
  for (let i = 0; i < section.sections.length; i++) {
    collectAdminFields(section.sections[i], `${path}.sections[${i}]`, out);
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function checkSufficiency(config: ExpandedConfig): Diagnostic[] {
  const diags: Diagnostic[] = [];
  const root = config.root;

  // Collect all sections and slots
  const allSections: ExpandedSection[] = [];
  collectSections(root, allSections);

  const allSlots: ExpandedSlot[] = [];
  collectSlots(root, allSlots);

  const allPatterns = allSlots.map((s) => s.seed_pattern).filter(Boolean);

  // -------------------------------------------------------------------------
  // pool_no_roster: pool_units_allowed:true with implicit-only registration
  // -------------------------------------------------------------------------
  const reg = root.registration_policy;
  if (reg?.pool_units_allowed && !reg.explicit) {
    diags.push(warn('pool_no_roster',
      'pool_units_allowed:true requires explicit registration to build a roster',
      'event.registration_policy'));
  }

  // -------------------------------------------------------------------------
  // organizer_dim_self_reg: any dimension with organizer_assigned cardinality
  // -------------------------------------------------------------------------
  for (const dim of root.dimensions ?? []) {
    if (dim.registration_cardinality === 'organizer_assigned') {
      diags.push(warn('organizer_dim_self_reg',
        `Dimension "${dim.axis}" uses organizer_assigned cardinality — organizer must assign all participants`,
        'event.dimensions'));
    }
  }

  // -------------------------------------------------------------------------
  // multi_reg_no_team_id: multi-registration + explicit reg + no {teamID}
  // -------------------------------------------------------------------------
  const hasMultiRegDim = (root.dimensions ?? []).some(
    (d) => d.registration_cardinality === 'multiple',
  );
  const hasExplicitReg = root.registration_policy?.explicit === true;
  const anyPatternHasTeamId = allPatterns.some((p) => patternHasVar(p, 'teamID'));

  if (hasMultiRegDim && hasExplicitReg && !anyPatternHasTeamId) {
    diags.push(warn('multi_reg_no_team_id',
      'Multi-registration dimension exists with explicit registration but no seed pattern contains {teamID} — duplicate game submissions may collide',
      'event.slots'));
  }

  // -------------------------------------------------------------------------
  // missing_event_id: no pattern has {eventID}, and no cross-event VarDef
  // (teamID, sectionID, attemptID) either — making seeds potentially non-unique
  // -------------------------------------------------------------------------
  const CROSS_EVENT_VARS = ['eventID', 'teamID', 'sectionID', 'attemptID'];
  const hasCrossEventVar = allPatterns.some((p) =>
    CROSS_EVENT_VARS.some((v) => patternHasVar(p, v)),
  );

  if (allPatterns.length > 0 && !hasCrossEventVar) {
    diags.push(warn('missing_event_id',
      'No seed pattern contains {eventID} or any cross-event scoping variable — seeds may not be globally unique',
      'event.slots'));
  }

  // -------------------------------------------------------------------------
  // tag_scrape_conflict: tag_present validity rule + scrape:true on same section
  // -------------------------------------------------------------------------
  for (const section of allSections) {
    const hasScrape = section.capture_policy?.scrape === true;
    if (!hasScrape) continue;
    for (const slot of section.slots) {
      if ('kind' in slot) continue;
      const s = slot as ExpandedSlot;
      if (s.validity_rules?.some((r) => r.predicate?.includes('tag_present'))) {
        diags.push(warn('tag_scrape_conflict',
          `Section "${section.name}": tag_present validity rule conflicts with scrape:true — scraping cannot filter by tags`,
          `event.sections`));
        break;
      }
    }
  }

  // -------------------------------------------------------------------------
  // forced_no_preassembly: algorithmic matchmaking without eligibility
  // (only when assignment is forced to a fixed number, not dynamic or admin)
  // -------------------------------------------------------------------------
  for (const section of allSections) {
    const mm = section.matchmaking as Matchmaking & { eligibility?: string; assignment?: unknown };
    if (mm?.type === 'algorithmic' && !mm.eligibility && typeof mm.assignment === 'number') {
      diags.push(warn('forced_no_preassembly',
        `Section "${section.name}": algorithmic matchmaking with fixed assignment size but no eligibility expression`,
        `event.sections`));
    }
  }

  // -------------------------------------------------------------------------
  // attempt_no_attempt_id: attempt_modifier.enabled:true without {attemptID}
  // -------------------------------------------------------------------------
  for (const slot of allSlots) {
    const am = slot.attempt_modifier as { enabled?: boolean } | undefined;
    if (am?.enabled && !patternHasVar(slot.seed_pattern, 'attemptID')) {
      diags.push(warn('attempt_no_attempt_id',
        `Slot "${slot.seed_pattern}": attempt_modifier.enabled is true but seed pattern lacks {attemptID}`,
        'event.slots'));
    }
  }

  // -------------------------------------------------------------------------
  // admin_input_required: notice for every admin-sentinel value
  // -------------------------------------------------------------------------
  collectAdminFields(root, 'event', diags);

  return diags;
}
