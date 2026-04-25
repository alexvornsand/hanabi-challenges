import { autocompletion, CompletionContext, CompletionResult, Completion } from '@codemirror/autocomplete';
import { COLOUR_HEX, ALL_COLOUR_TOKENS } from '../../lib/colourTokens';

// ---------------------------------------------------------------------------
// Context detection helpers
// ---------------------------------------------------------------------------

/**
 * Walk backwards from the cursor to find the YAML key on the current line.
 * Returns the trimmed key string (without the trailing colon) or null.
 */
function currentLineKey(ctx: CompletionContext): string | null {
  const line = ctx.state.doc.lineAt(ctx.pos);
  const text = line.text.trimStart();
  const match = /^([\w_-]+)\s*:\s*/.exec(text);
  return match ? match[1] : null;
}

/**
 * Find the nearest ancestor key by walking up to lines with lower indentation.
 */
function parentKey(ctx: CompletionContext): string | null {
  const line = ctx.state.doc.lineAt(ctx.pos);
  const currentIndent = line.text.search(/\S/);
  for (let lineNo = line.number - 1; lineNo >= 1; lineNo--) {
    const prevLine = ctx.state.doc.line(lineNo);
    const indent = prevLine.text.search(/\S/);
    if (indent < currentIndent && indent >= 0) {
      const match = /^\s*([\w_-]+)\s*:/.exec(prevLine.text);
      if (match) return match[1];
    }
  }
  return null;
}

/**
 * Check if the cursor is positioned after a colon (i.e. value position).
 */
function isValuePosition(ctx: CompletionContext): boolean {
  const line = ctx.state.doc.lineAt(ctx.pos);
  const before = line.text.slice(0, ctx.pos - line.from);
  return /:\s*$/.test(before) || /:\s+\S*$/.test(before);
}

// ---------------------------------------------------------------------------
// Completion data
// ---------------------------------------------------------------------------

const SCORING_UNIT_TYPE_VALUES: Completion[] = [
  { label: 'individual', detail: 'one player per unit' },
  { label: 'team', detail: 'multiple players per unit' },
  { label: 'inferred', detail: 'inferred from game participants' },
];

const FN_VALUES: Completion[] = [
  { label: 'match_aggregate', detail: 'aggregate across matched games' },
  { label: 'elo', detail: 'ELO rating' },
  { label: 'derived_ranking', detail: 'derived from ranking position' },
];

const MATCHMAKING_TYPE_VALUES: Completion[] = [
  { label: 'none', detail: 'no matchmaking' },
  { label: 'manual', detail: 'admin assigns manually' },
  { label: 'algorithmic', detail: 'system-generated matchups' },
];

const BADGE_SHAPE_VALUES: Completion[] = [
  { label: 'circle' },
  { label: 'shield' },
  { label: 'star' },
  { label: 'ribbon' },
  { label: 'hex' },
];

const ADMIN_SENTINEL: Completion = {
  label: 'admin',
  detail: 'Defers to organiser at runtime',
  info: 'This field will be filled in by an organiser after publishing.',
};

/**
 * Build colour token completions with coloured swatch in the `info` element.
 */
function buildColourCompletions(): Completion[] {
  return ALL_COLOUR_TOKENS.map((token) => {
    const hex = COLOUR_HEX[token];
    return {
      label: token,
      detail: `${token.includes('-') ? token.split('-')[0] : 'sequential'}`,
      info: () => {
        const el = document.createElement('span');
        el.style.cssText = `
          display: inline-flex; align-items: center; gap: 6px;
          font-family: monospace; font-size: 12px;
        `;
        const swatch = document.createElement('span');
        swatch.style.cssText = `
          display: inline-block; width: 12px; height: 12px;
          border-radius: 2px; border: 1px solid rgba(0,0,0,0.2);
          background: ${hex.light};
          flex-shrink: 0;
        `;
        el.appendChild(swatch);
        el.appendChild(document.createTextNode(token));
        return el;
      },
    };
  });
}

const COLOUR_COMPLETIONS = buildColourCompletions();

// ---------------------------------------------------------------------------
// Completion source
// ---------------------------------------------------------------------------

export function dslCompletionSource(
  generatorNames: string[] = [],
  sectionNames: string[] = [],
) {
  return (ctx: CompletionContext): CompletionResult | null => {
    if (!isValuePosition(ctx)) return null;

    const key = currentLineKey(ctx);
    const parent = parentKey(ctx);

    // Colour tokens at accent: or colour: positions
    if (key === 'accent' || key === 'colour') {
      return { from: ctx.pos, options: COLOUR_COMPLETIONS, validFor: /^[\w-]*$/ };
    }

    // scoring_unit_type values
    if (key === 'scoring_unit_type') {
      return { from: ctx.pos, options: SCORING_UNIT_TYPE_VALUES, validFor: /^\w*$/ };
    }

    // fn values at aggregation_function.fn
    if (key === 'fn' && parent === 'aggregation_function') {
      return { from: ctx.pos, options: FN_VALUES, validFor: /^\w*$/ };
    }

    // matchmaking.type values
    if (key === 'type' && parent === 'matchmaking') {
      return { from: ctx.pos, options: MATCHMAKING_TYPE_VALUES, validFor: /^\w*$/ };
    }

    // badge.shape values
    if (key === 'shape' && parent === 'badge') {
      return { from: ctx.pos, options: BADGE_SHAPE_VALUES, validFor: /^\w*$/ };
    }

    // admin sentinel at any deferrable field
    const DEFERRABLE_KEYS = new Set(['start', 'end', 'assignments', 'decision']);
    if (key && DEFERRABLE_KEYS.has(key)) {
      return { from: ctx.pos, options: [ADMIN_SENTINEL], validFor: /^\w*$/ };
    }

    // generator names at generator: positions
    if (key === 'generator' && generatorNames.length > 0) {
      return {
        from: ctx.pos,
        options: generatorNames.map((n) => ({ label: n })),
        validFor: /^[\w_-]*$/,
      };
    }

    // section names at proceeds_to: or scope: positions
    if ((key === 'proceeds_to' || key === 'scope') && sectionNames.length > 0) {
      return {
        from: ctx.pos,
        options: sectionNames.map((n) => ({ label: n })),
        validFor: /^[\w_-]*$/,
      };
    }

    return null;
  };
}

/**
 * Returns a CodeMirror extension for DSL completions.
 * Pass dynamic names from the latest pipeline result.
 */
export function dslCompletionExtension(
  generatorNames: string[] = [],
  sectionNames: string[] = [],
) {
  return autocompletion({
    override: [dslCompletionSource(generatorNames, sectionNames)],
  });
}
