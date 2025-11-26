# Cards

Tokens and source
- Tokens live in `frontend/src/styles/tokens.css`. Cards should reference the token names below rather than hard-coded values.

Decisions (token references)
- Max width: 100% by default; “panel” max width token `var(--max-width-panel)` for standalone/wide contexts.
- Padding: `var(--space-md)` inset.
- Border/Radius/Shadow: border `1px solid var(--color-border)` (swap to `--color-border-dark` in dark), radius `var(--radius-md)`, shadow `var(--shadow-light)` by default (use `--shadow-hover` for elevated states).
- Structure: optional header (title + actions), body stack gap `var(--space-sm)`, optional footer that hosts button arrays (spacing handled by button-group, not the card). Title font size `var(--font-title-size)`, margin 0.
- Background: `var(--color-surface)` (swap to `--color-surface-dark` in dark theme).
- Margin: no intrinsic margins; spacing between cards comes from layout primitives (e.g., card stacks/grids).

Implementation (planned)
- Component: `src/components/Card.tsx` that accepts optional header/footer slots and an optional `maxWidth` prop (defaults to 100%, panel variant at `var(--max-width-panel)`). Footer content is expected to use a button-group to control button spacing.
- Styles: shared card styles using tokens (padding `var(--space-md)`, radius `var(--radius-md)`, border/shadow tokens, surface tokens). No baked-in margins.
- Layout utilities: card stacks/grids will control outer spacing (e.g., `CardStack` with gap tokens, and a grid wrapper for multi-column layouts).

Usage (planned)
- Wrap content in `<Card>` with optional `header`/`footer` slots. Use layout wrappers (`CardStack`, grid) to place multiple cards and handle spacing. Use a ButtonGroup/ButtonArray in footers to control button spacing instead of padding within the card itself.
