# Buttons

Tokens and source
- Tokens live in `frontend/src/styles/tokens.css`. Buttons reference token names rather than literals.

Decisions (token references)
- Sizes: default padding `var(--button-padding-y)` / `var(--button-padding-x)`; small padding `var(--button-padding-y-sm)` / `var(--button-padding-x-sm)`; radius `var(--button-radius)`.
- Typography: default font size `var(--font-body-size)`, small uses `var(--font-small-size)`. Weight `var(--font-button-weight)` (600).
- Colors (light): primary bg `var(--button-primary-bg)`, text `var(--button-primary-text)`; secondary bg `var(--button-secondary-bg)`, text `var(--button-secondary-text)`, border `var(--button-secondary-border)`; ghost bg `var(--button-ghost-bg)`, text `var(--button-ghost-text)`. Dark theme uses the corresponding `...-dark` tokens.
- States: hover/active darken the background slightly (implementation detail); disabled uses `opacity: var(--button-disabled-opacity)` and `cursor: not-allowed`, no hover/active change.
- Icon spacing: gap between icon and label `var(--button-gap-icon)`.
- Button groups/arrays: default horizontal gap `var(--button-gap-group)`, allow wrapping. Alignment options (to be supported in a ButtonGroup primitive): left, center, right, and split (space-between) for common layouts. Vertical stacks can use a variant or a separate vertical group.

Implementation (planned)
- Component: `src/components/Button.tsx` with variants (primary, secondary, ghost), sizes (default, small), and disabled state, applying the tokens above.
- Component: `src/components/ButtonGroup.tsx` (or similar) to arrange buttons horizontally or vertically with configurable alignment (left/center/right/split) and gap `var(--button-gap-group)`.
- Styles: shared button styles using tokenized padding, radius, typography, colors, icon gap, and disabled opacity. Hover/active will slightly darken the background/text where applicable.

Usage (planned)
- Use `<Button variant="primary" size="sm|md" ...>` for actions. For multiple buttons, wrap in `<ButtonGroup align="right|left|center|split" direction="row|column">…</ButtonGroup>` to control spacing/alignment consistently, instead of ad-hoc margins.
