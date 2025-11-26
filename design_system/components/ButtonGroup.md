# Button Groups

Tokens and source
- Tokens live in `frontend/src/styles/tokens.css`. Button groups reference token names rather than literals.

Decisions (token references)
- Gap: `var(--button-gap-group)` between buttons.
- Direction: row (default) or column for vertical stacks.
- Alignment: left, center, right (default), split (space-between). Alignment controls horizontal distribution in row mode; in column mode, align-items defaults to stretch/left.
- Icon spacing: individual buttons use `var(--button-gap-icon)` for icon + label spacing.

Implementation (planned)
- Component: `src/components/ButtonGroup.tsx` (or similar) to wrap button children, applying flex layout with configurable `direction` and `align`, and gap `var(--button-gap-group)`.
- Styles: flex container with gap token, `flex-wrap: wrap` to accommodate narrow viewports; `justify-content` driven by `align` prop (`flex-start`, `center`, `flex-end`, `space-between`). In column mode, use `flex-direction: column` and gap token.

Usage (planned)
- Wrap buttons in `<ButtonGroup align="right|left|center|split" direction="row|column">…</ButtonGroup>` to enforce consistent spacing/alignment instead of ad-hoc margins. Default: row + right alignment.
