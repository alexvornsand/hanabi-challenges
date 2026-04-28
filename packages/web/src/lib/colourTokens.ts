import type { ColourToken } from '@hanabi/dsl';

// Hex values for all 42 colour tokens (light/dark pair).
// Sequential and semantic tokens use the same value in both modes.
// Hue tokens use Tailwind-inspired palette steps (0 = lightest, 9 = darkest).
export const COLOUR_HEX: Record<ColourToken, { light: string; dark: string }> = {
  // ── Sequential (rank medals) ──────────────────────────────────────────────
  diamond:  { light: '#b9f2ff', dark: '#b9f2ff' },
  platinum: { light: '#e5e4e2', dark: '#e5e4e2' },
  gold:     { light: '#ffd700', dark: '#ffd700' },
  silver:   { light: '#c0c0c0', dark: '#c0c0c0' },
  bronze:   { light: '#cd7f32', dark: '#cd7f32' },
  iron:     { light: '#808080', dark: '#808080' },
  ash:      { light: '#b2b2b2', dark: '#b2b2b2' },

  // ── Semantic (positive / neutral / negative) ──────────────────────────────
  'pos-2': { light: '#16a34a', dark: '#16a34a' },
  'pos-1': { light: '#22c55e', dark: '#22c55e' },
  mid:     { light: '#a3a3a3', dark: '#a3a3a3' },
  'neg-1': { light: '#f97316', dark: '#f97316' },
  'neg-2': { light: '#ef4444', dark: '#ef4444' },

  // ── Hue — green ───────────────────────────────────────────────────────────
  'green-0': { light: '#f0fdf4', dark: '#f0fdf4' },
  'green-1': { light: '#dcfce7', dark: '#dcfce7' },
  'green-2': { light: '#bbf7d0', dark: '#bbf7d0' },
  'green-3': { light: '#86efac', dark: '#86efac' },
  'green-4': { light: '#4ade80', dark: '#4ade80' },
  'green-5': { light: '#22c55e', dark: '#22c55e' },
  'green-6': { light: '#16a34a', dark: '#16a34a' },
  'green-7': { light: '#15803d', dark: '#15803d' },
  'green-8': { light: '#166534', dark: '#166534' },
  'green-9': { light: '#14532d', dark: '#14532d' },

  // ── Hue — blue ────────────────────────────────────────────────────────────
  'blue-0': { light: '#eff6ff', dark: '#eff6ff' },
  'blue-1': { light: '#dbeafe', dark: '#dbeafe' },
  'blue-2': { light: '#bfdbfe', dark: '#bfdbfe' },
  'blue-3': { light: '#93c5fd', dark: '#93c5fd' },
  'blue-4': { light: '#60a5fa', dark: '#60a5fa' },
  'blue-5': { light: '#3b82f6', dark: '#3b82f6' },
  'blue-6': { light: '#2563eb', dark: '#2563eb' },
  'blue-7': { light: '#1d4ed8', dark: '#1d4ed8' },
  'blue-8': { light: '#1e40af', dark: '#1e40af' },
  'blue-9': { light: '#1e3a8a', dark: '#1e3a8a' },

  // ── Hue — magenta ─────────────────────────────────────────────────────────
  'magenta-0': { light: '#fdf4ff', dark: '#fdf4ff' },
  'magenta-1': { light: '#fae8ff', dark: '#fae8ff' },
  'magenta-2': { light: '#f5d0fe', dark: '#f5d0fe' },
  'magenta-3': { light: '#f0abfc', dark: '#f0abfc' },
  'magenta-4': { light: '#e879f9', dark: '#e879f9' },
  'magenta-5': { light: '#d946ef', dark: '#d946ef' },
  'magenta-6': { light: '#c026d3', dark: '#c026d3' },
  'magenta-7': { light: '#a21caf', dark: '#a21caf' },
  'magenta-8': { light: '#86198f', dark: '#86198f' },
  'magenta-9': { light: '#701a75', dark: '#701a75' },
};

export const ALL_COLOUR_TOKENS = Object.keys(COLOUR_HEX) as ColourToken[];
