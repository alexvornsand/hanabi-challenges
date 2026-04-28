import type { Diagnostic, SeedPatternContext, SeedBoundVars, SeedConflict } from './types.js';

// ---------------------------------------------------------------------------
// Variable definitions
// ---------------------------------------------------------------------------

interface VarDef {
  key: keyof SeedBoundVars;
  prefix: string;     // prefix for prefixed form e.g. 'e' for {eventID}
  tag: string;        // e.g. 'eventID'
}

const VAR_DEFS: VarDef[] = [
  { key: 'eventID', prefix: 'e', tag: 'eventID' },
  { key: 'sectionID', prefix: 's', tag: 'sectionID' },
  { key: 'slotIndex', prefix: 'g', tag: 'slotIndex' },
  { key: 'teamID', prefix: 't', tag: 'teamID' },
  { key: 'attemptID', prefix: 'a', tag: 'attemptID' },
];

// Build lookup maps
const TAG_TO_DEF = new Map(VAR_DEFS.map((d) => [d.tag, d]));

// ---------------------------------------------------------------------------
// Pattern parsing
// ---------------------------------------------------------------------------

type PatternSegment =
  | { kind: 'literal'; value: string }
  | { kind: 'prefixed'; tag: keyof SeedBoundVars; prefix: string }
  | { kind: 'bare'; tag: keyof SeedBoundVars };

function parsePattern(pattern: string): PatternSegment[] {
  const segments: PatternSegment[] = [];
  let i = 0;
  let literalBuf = '';

  while (i < pattern.length) {
    if (pattern[i] !== '{') {
      literalBuf += pattern[i++];
      continue;
    }

    // Flush literal buffer
    if (literalBuf) {
      segments.push({ kind: 'literal', value: literalBuf });
      literalBuf = '';
    }

    // Parse {varName} or {varName*}
    i++; // skip {
    let varName = '';
    while (i < pattern.length && pattern[i] !== '}') varName += pattern[i++];
    i++; // skip }

    const isBare = varName.endsWith('*');
    const tag = isBare ? varName.slice(0, -1) : varName;
    const def = TAG_TO_DEF.get(tag);

    if (!def) {
      // Unknown variable — treat as literal
      literalBuf += '{' + varName + '}';
      continue;
    }

    if (isBare) {
      segments.push({ kind: 'bare', tag: def.key });
    } else {
      segments.push({ kind: 'prefixed', tag: def.key, prefix: def.prefix });
    }
  }

  if (literalBuf) {
    segments.push({ kind: 'literal', value: literalBuf });
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Spec generation
// ---------------------------------------------------------------------------

export function generateSpecs(pattern: string, boundVars: SeedBoundVars): string[] {
  const segments = parsePattern(pattern);
  let spec = '';

  for (const seg of segments) {
    if (seg.kind === 'literal') {
      spec += seg.value;
    } else if (seg.kind === 'prefixed') {
      const val = boundVars[seg.tag];
      if (val === undefined) {
        // Variable not bound — leave as placeholder
        spec += `{${seg.tag}}`;
      } else {
        spec += seg.prefix + val;
      }
    } else {
      // bare
      const val = boundVars[seg.tag];
      if (val === undefined) {
        spec += `{${seg.tag}*}`;
      } else {
        spec += val;
      }
    }
  }

  return [spec];
}

// ---------------------------------------------------------------------------
// issueSpec (single resolution of all vars including unbounded)
// ---------------------------------------------------------------------------

export function issueSpec(
  pattern: string,
  boundVars: SeedBoundVars,
  _unboundVars: string[],
): string {
  return generateSpecs(pattern, boundVars)[0]!;
}

// ---------------------------------------------------------------------------
// checkConflicts
// ---------------------------------------------------------------------------

export function checkConflicts(specs: string[], registry: Set<string>): SeedConflict[] {
  const conflicts: SeedConflict[] = [];
  const seen = new Set<string>();

  for (const spec of specs) {
    // Check against external registry
    if (registry.has(spec)) {
      conflicts.push({ spec, conflictsWith: spec });
    }
    // Check against already-seen in this batch
    if (seen.has(spec)) {
      conflicts.push({ spec, conflictsWith: spec });
    }
    seen.add(spec);
  }

  return conflicts;
}

// ---------------------------------------------------------------------------
// validatePattern
// ---------------------------------------------------------------------------

export function validatePattern(
  pattern: string,
  context: SeedPatternContext,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const segments = parsePattern(pattern);

  // Collect which variable types are present
  const presentTags = new Set<keyof SeedBoundVars>();
  for (const seg of segments) {
    if (seg.kind !== 'literal') presentTags.add(seg.tag);
  }

  // Check 1: literal matches prefixed variable format (e.g. 'e5', 'a3')
  for (const seg of segments) {
    if (seg.kind === 'literal') {
      for (const def of VAR_DEFS) {
        if (/^[a-z]\d+$/.test(seg.value) && seg.value.startsWith(def.prefix)) {
          diagnostics.push({
            code: 'pattern_literal_matches_variable',
            severity: 'warning',
            message: `Literal "${seg.value}" matches the format of a prefixed variable ({${def.tag}}). This may cause ambiguity.`,
          });
        }
      }
    }
  }

  // Check 2: attempt modifier enabled but no attemptID in pattern
  if (context.hasAttemptModifier && !presentTags.has('attemptID')) {
    diagnostics.push({
      code: 'attempt_id_missing',
      severity: 'error',
      message: 'Attempt modifier is enabled but {attemptID} or {attemptID*} is not present in the seed pattern. Add {attemptID} to prevent seed collisions across attempts.',
    });
  }

  // Check 3: multi-registration enabled but no teamID in pattern
  if (context.hasMultiRegistration && !presentTags.has('teamID')) {
    diagnostics.push({
      code: 'team_id_missing',
      severity: 'error',
      message: 'Multi-registration is enabled but {teamID} or {teamID*} is not present in the seed pattern. Add {teamID} to prevent seed collisions across teams.',
    });
  }

  // Check 4: adjacent bare integer variables without separator
  for (let i = 0; i < segments.length - 1; i++) {
    const curr = segments[i]!;
    const next = segments[i + 1]!;
    if (curr.kind === 'bare' && next.kind === 'bare') {
      diagnostics.push({
        code: 'adjacent_bare_variables',
        severity: 'warning',
        message: `Adjacent bare integer variables {${curr.tag}*} and {${next.tag}*} produce ambiguous segment boundaries. Add a separator literal between them.`,
      });
    }
  }

  // Check 5: no eventID anywhere
  if (!presentTags.has('eventID')) {
    diagnostics.push({
      code: 'missing_event_id',
      severity: 'warning',
      message: 'Seed pattern does not include {eventID} or {eventID*}. Event ID is strongly recommended for global uniqueness.',
    });
  }

  return diagnostics;
}
