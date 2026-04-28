import { hoverTooltip, EditorView } from '@codemirror/view';

// ---------------------------------------------------------------------------
// Field documentation table
// Covers fields from §3.2 (section config) and §7 (slot / generator config)
// ---------------------------------------------------------------------------

interface FieldDoc {
  type: string;
  description: string;
  default?: string;
}

const FIELD_DOCS: Record<string, FieldDoc> = {
  // ── Event / section level ─────────────────────────────────────────────────
  name:                  { type: 'string', description: 'Display name of the event or section.' },
  slug:                  { type: 'string', description: 'URL-safe identifier. Must be unique across all events.' },
  scoring_unit_type:     { type: '"individual"|"team"|"inferred"', description: 'How scoring units are determined.', default: 'individual' },
  organisers:            { type: 'string[]', description: 'Platform display names of users who can manage this event.' },
  classification_rule:   { type: 'expr → string', description: 'Expression evaluated per unit to assign a classification label.' },
  conditional_activation:{ type: 'expr → bool', description: 'Guard expression; section activates only when true.' },
  non_participant_result:{ type: 'expr → number', description: 'Score used for units that did not participate.', default: '0' },

  // ── Aggregation function ──────────────────────────────────────────────────
  aggregation_function:  { type: 'object', description: 'How game results are aggregated into a section score.' },
  fn:                    { type: '"match_aggregate"|"elo"|"derived_ranking"', description: 'Aggregation algorithm.' },
  rank_by:               { type: 'string', description: 'Expression or field name used for ranking.' },
  tiebreak:              { type: 'string[]', description: 'Ordered list of tiebreaker expressions.' },

  // ── Capture policy ────────────────────────────────────────────────────────
  capture_policy:        { type: 'object', description: 'Controls which game capture methods are accepted.' },
  submit:                { type: 'bool', description: 'Allow manual game submission.', default: 'true' },
  scrape:                { type: 'bool', description: 'Allow automatic scraping from hanab.live.', default: 'true' },
  transition:            { type: 'expr → bool', description: 'Expression; when true, switches capture mode.' },

  // ── Registration policy ───────────────────────────────────────────────────
  registration_policy:   { type: 'object', description: 'Controls how players register for a section.' },
  implicit:              { type: 'bool', description: 'Auto-register players on first game submission.', default: 'true' },
  explicit:              { type: 'bool', description: 'Require explicit opt-in registration.', default: 'false' },
  pool_units_allowed:    { type: 'bool', description: 'Allow pool-unit registration (carry-over teams).', default: 'false' },

  // ── Time window ───────────────────────────────────────────────────────────
  time_window:           { type: 'object', description: 'Active time window for this section.' },
  start:                 { type: 'ISO8601 | "admin"', description: 'Section opens at this datetime. "admin" defers to organiser.', default: 'admin' },
  end:                   { type: 'ISO8601 | "admin"', description: 'Section closes at this datetime. "admin" defers to organiser.' },

  // ── Matchmaking ───────────────────────────────────────────────────────────
  matchmaking:           { type: 'object', description: 'Controls how units are paired for slots.' },
  type:                  { type: '"none"|"manual"|"algorithmic"', description: 'Matchmaking strategy.', default: 'none' },

  // ── Advancement ───────────────────────────────────────────────────────────
  advancement:           { type: 'object', description: 'Controls how units advance to the next section.' },
  predicate:             { type: 'expr → bool | "admin"', description: 'Evaluated per unit to determine if they advance. "admin" defers.' },
  proceeds_to:           { type: 'string', description: 'Name of the section units advance into.' },

  // ── Promotion / relegation ────────────────────────────────────────────────
  promotion_relegation:  { type: 'object', description: 'Division system configuration.' },
  clamp:                 { type: 'bool', description: 'Prevent units from promoting beyond the top division.', default: 'false' },

  // ── Row styles ────────────────────────────────────────────────────────────
  row_styles:            { type: 'RowStyle[]', description: 'Visual decorations applied to scoreboard rows based on predicates.' },
  accent:                { type: 'ColourToken', description: 'Colour token for the row ribbon decoration.' },
  label:                 { type: 'string', description: 'Text label shown inside the row ribbon.' },

  // ── Awards ────────────────────────────────────────────────────────────────
  awards:                { type: 'Award[]', description: 'Awards granted to units meeting defined criteria.' },
  badge:                 { type: 'object', description: 'Badge visual configuration for an award.' },
  shape:                 { type: '"circle"|"shield"|"star"|"ribbon"|"hex"', description: 'Badge shape.', default: 'circle' },
  colour:                { type: 'ColourToken', description: 'Badge fill colour token.' },

  // ── Slots ─────────────────────────────────────────────────────────────────
  slots:                 { type: 'SlotDef[]', description: 'Game slot definitions for this section.' },
  seed_pattern:          { type: 'string', description: 'Seed formula. Tokens: {eventID}, {sectionID}, {slotIndex}, {unitID}.' },
  variant_id:            { type: 'number', description: 'Hanab.live variant ID for this slot.' },
  validity_rules:        { type: 'ValidityRule[]', description: 'Rules that must be satisfied for a game submission to be accepted.' },
  lazy_trigger:          { type: '"completion"|"action"|"admin"', description: 'How a lazy slot is triggered.', default: 'completion' },

  // ── Generators ───────────────────────────────────────────────────────────
  generators:            { type: 'Generator[]', description: 'Named slot generator definitions.' },
  generator:             { type: 'string', description: 'Reference to a named generator.' },
  trigger_type:          { type: '"attempt_start"|"bracket_activation"|"admin_sequence"', description: 'How the generator is triggered.' },
  slot_template:         { type: 'object', description: 'Template for slots produced by this generator.' },

  // ── Scoreboards ──────────────────────────────────────────────────────────
  scoreboards:           { type: 'Scoreboard[]', description: 'Scoreboard view definitions.' },
  scope:                 { type: 'string', description: 'Section name whose results this scoreboard displays.' },
  is_primary:            { type: 'bool', description: 'Whether this is the primary scoreboard shown by default.', default: 'false' },
};

// ---------------------------------------------------------------------------
// Hover extension
// ---------------------------------------------------------------------------

export function dslHoverExtension() {
  return hoverTooltip((view: EditorView, pos: number) => {
    const word = view.state.wordAt(pos);
    if (!word) return null;
    const token = view.state.sliceDoc(word.from, word.to);
    const doc = FIELD_DOCS[token];
    if (!doc) return null;

    return {
      pos: word.from,
      end: word.to,
      above: true,
      create() {
        const dom = document.createElement('div');
        dom.style.cssText = `
          padding: 6px 10px; font-family: monospace; font-size: 12px;
          max-width: 360px; line-height: 1.5;
        `;

        const typeLine = document.createElement('div');
        typeLine.style.cssText = 'color: #3b82f6; margin-bottom: 4px;';
        typeLine.textContent = doc.type;
        dom.appendChild(typeLine);

        const descLine = document.createElement('div');
        descLine.style.color = '#374151';
        descLine.textContent = doc.description;
        dom.appendChild(descLine);

        if (doc.default !== undefined) {
          const defaultLine = document.createElement('div');
          defaultLine.style.cssText = 'color: #9ca3af; margin-top: 2px; font-size: 11px;';
          defaultLine.textContent = `Default: ${doc.default}`;
          dom.appendChild(defaultLine);
        }

        return { dom };
      },
    };
  });
}
