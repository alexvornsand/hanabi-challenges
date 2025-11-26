# Forms

Tokens and source
- Tokens live in `frontend/src/styles/tokens.css`. Forms reference these tokens rather than literals.

Field sizes and modular height
- Default input padding: `var(--input-padding-y)` / `var(--input-padding-x)`; radius `var(--input-radius)`.
- Small input padding: `var(--input-padding-y-sm)` / `var(--input-padding-x-sm)` for inline/table use.
- Target heights: default `var(--input-height)` (40px), small `var(--input-height-sm)` (32px) for single-line controls (text, select, button-aligned). Checkbox/radio sized to ~16px with `var(--radius-sm)`.
- Note: Multiline/textarea will naturally exceed the target height; that’s acceptable—“Lego” alignment applies to single-line controls.

Typography
- Inputs: font size `var(--font-body-size)` (small variant can use `var(--font-small-size)`); weight `var(--font-body-weight)`.
- Labels: `var(--font-small-size)`, weight 600; helper/error: `var(--font-small-size)`, weight 400.

Borders, backgrounds, focus
- Border: `1px solid var(--color-border)` (dark: `--color-border-dark`).
- Background: `var(--color-surface)` / `--color-surface-dark`.
- Focus: accent border (`--color-accent-strong`) and focus halo `var(--input-focus-shadow)`; background remains surface.
- Hover: slight border darken.

States
- Disabled: `opacity: var(--button-disabled-opacity)`, `cursor: not-allowed`, no hover/focus.
- Error: border/text use semantic negative (`--color-sem-negative-text`), optional light tint background for visibility (implementation TBD).

Spacing
- Label-to-field gap: `var(--space-xxs)`.
- Field-to-helper/error gap: `var(--space-xxs)`.
- Stack multiple fields with `Stack` gap tokens (`var(--gap-stack-default)`).

Inline/compact usage
- Use the small variant for inline/table contexts to align with tight table density.
- Align controls to maintain row height; prefer revealing inline edit controls on hover/focus/active rather than always showing.

Groups
- Fieldset/legend: legend uses label style; group gap `var(--space-sm)`; fields inside a group use the same gaps as above.***
