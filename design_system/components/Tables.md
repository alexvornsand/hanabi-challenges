# Tables

Tokens and source
- Tokens live in `frontend/src/styles/tokens.css`. Tables should reference token names rather than literals where possible.

Padding and density
- Two padding/density variants:
  - Relaxed (default): cell padding `var(--space-xs)` vertical, `var(--space-sm)` horizontal.
  - Tight: cell padding `var(--space-xxs)` vertical, `var(--space-xs)` horizontal.
- Row height is implied by padding; compact/tight rows use the tight padding, relaxed rows use the relaxed padding.

Typography
- Header: font size `var(--font-body-size)`, weight 600.
- Body: font size `var(--font-small-size)` or `var(--font-body-size)` depending on context; default to `var(--font-body-size)` if you prefer larger body text than header.

Borders, separators, backgrounds
- Header bottom border: `1px solid var(--color-border)`.
- Row separators: `1px solid var(--color-border)` on body rows; no row banding by default.
- Hover: background `var(--color-surface-muted)`; consider disabled/locked rows skipping hover.
- Header background: `var(--color-surface-muted)` (swap to muted dark in dark mode).

Alignment
- Default left alignment.
- Numeric columns: right aligned (utility/class recommended).

States
- Empty state: standard empty message inside the table container.
- Loading state: optional overlay/spinner; rows remain sized.

Actions/inline controls
- Use small buttons and grouped with `var(--button-gap-group)` spacing; try to keep row heights constant (fit controls within the chosen padding/density).
- For editable cells (e.g., forms in table), reveal controls on hover/focus/active; otherwise render as plain text/placeholder to maintain visual calm. Ensure focusable for keyboard users; on touch/small screens consider always showing or using tap-to-edit so controls are discoverable.

Implementation (planned)
- Component: `Table` (in `components/common/Table`) with density variants (relaxed/tight), header/body styling per tokens, hover without striping, optional header/footer separators.
- Utilities: alignment helpers (e.g., numeric), action button groups sized to the tight variant for inline controls.
- Wrapper pattern: a “Table Block” (header + KPI/actions + optional collapse) should be composed outside the Table component; header uses layout/pill/button primitives, table uses the Table component.

Usage (planned)
- Default to relaxed density; opt into tight for dense data. Apply numeric alignment where appropriate. Use hover affordance but skip striping. Keep actions compact and reveal editable controls on interaction when possible.
