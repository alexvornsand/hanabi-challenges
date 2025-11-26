# Colors

Tokens and source
- Tokens live in `frontend/src/styles/tokens.css`. Use token names rather than literals.

Categorical palette (non-red/green)
- `--color-cat-1` … `--color-cat-12` for light surfaces; `--color-cat-*-dark` for dark surfaces. Use these for chart series and categorical accents; reds/greens are reserved for semantic use.

Semantic text-on-surface
- `--color-on-light` for text/icons on light surfaces; `--color-on-dark` for text/icons on dark surfaces.

Accent and surfaces
- Accent tokens: `--color-accent-weak/strong` and `--color-accent-weak/strong-dark`.
- Surfaces/text: `--color-surface`/`--color-surface-muted` and dark variants; text tokens `--color-text`, `--color-text-muted` and dark variants.
- Border tokens: `--color-border` / `--color-border-dark`.

Ordinal/sequential palettes (non-red/green)
- Blue scale: `--color-scale-blue-1` … `--color-scale-blue-5` (light to dark).
- Purple scale: `--color-scale-purple-1` … `--color-scale-purple-5`.
- Amber scale: `--color-scale-amber-1` … `--color-scale-amber-5`.

Semantic colors
- Positive text: `--color-sem-positive-text` (light), `--color-sem-positive-text-dark` (dark) — current set taken from reference palette.
- Neutral text: `--color-sem-neutral-text` (light), `--color-sem-neutral-text-dark` (dark).
- Negative text: `--color-sem-negative-text` (light), `--color-sem-negative-text-dark` (dark).
- For backgrounds, use the surface tokens (`--color-surface` / `--color-surface-dark`) or surface-muted as appropriate; semantic colors are primarily for text accents to retain contrast across themes.

Usage
- Use categorical tokens for distinct series/categories.
- Use sequential scales for ordered/ordinal data.
- Use `--color-on-light` / `--color-on-dark` for legible text/icon color over their respective surfaces.
- Accent tokens for primary actions/highlights; surface tokens for backgrounds and cards.
