# Theme (Light/Dark)

Tokens and source
- Tokens live in `frontend/src/styles/tokens.css`. Light and dark variants are provided for surfaces, text, borders, accents, and categorical/semantic colors.

Light vs Dark
- Light: use `--color-surface`, `--color-surface-muted`, `--color-text`, `--color-text-muted`, `--color-border`, `--color-accent-*`.
- Dark: swap to `--color-surface-dark`, `--color-surface-muted-dark`, `--color-text-dark`, `--color-text-muted-dark`, `--color-border-dark`, `--color-accent-*-dark`.
- Semantic/categorical colors include dark counterparts (`--color-cat-*-dark`, semantic text dark tokens).

Strategy
- Components should reference tokens, not literals, so theme switching can be handled by toggling a class on `body` or `:root` that overrides color tokens to their dark variants.
- Default is light; when dark mode is enabled, override surface/text/border/accent tokens to their dark equivalents.

Implementation (planned)
- Add a theme wrapper (e.g., `body.dark`) that reassigns the `--color-*` tokens to their `*-dark` values.
- Ensure components (cards, modals, buttons, pills, tables, inputs) all use tokens for colors so they inherit theme changes automatically.
- Handle focus/hover states with token-aware values; avoid hard-coded RGBA values tied to light theme.
