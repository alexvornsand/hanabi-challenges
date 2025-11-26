# Icons & Close Affordances

Tokens and source
- Tokens live in `frontend/src/styles/tokens.css`; icon sizes/colors reference existing text and spacing tokens.

Icon sizing/colors
- Default icon size: 16–18px for inline use.
- Gap to text: `var(--button-gap-icon)` or `var(--space-xxs)`.
- Color: use `--color-text` for primary icons and `--color-text-muted` for secondary; swap to `--color-text-dark`/`--color-text-muted-dark` in dark mode.

Close affordances
- Size: ~16–18px.
- Placement: top-right of headers; padding 4px with a small negative margin to align.
- Color: `--color-text` (light) / `--color-text-dark` (dark); hover can reduce opacity/brightness slightly.
- Focus: show a visible focus outline consistent with input/button focus styles.

Usage
- Reuse a single close affordance pattern across modals, cards, banners.
- For interactive icons, ensure focusability and keyboard activation.
