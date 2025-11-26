# Layout (Stacks, Rows, Containers, Grids)

Tokens and source
- Tokens live in `frontend/src/styles/tokens.css`. Refer to token names, not literals.

Decisions (token references)
- Page/container max width: `var(--max-width-page)`; panel width: `var(--max-width-panel)`. Page padding: `var(--page-padding)`.
- Stack gaps: default `var(--gap-stack-default)`; after title `var(--gap-stack-title)`, after secondary heading `var(--gap-stack-secondary)`, after tertiary heading `var(--gap-stack-tertiary)`. Other content separated by the default gap.
- Row gaps: `var(--gap-row-default)` for inline groups; allow variants (xs/sm/md/lg) via spacing tokens.
- Sections: vertical padding `var(--section-padding-y)`, horizontal `var(--section-padding-x)` (0 by default; use container/page padding to control horizontal rhythm).
- Card stacks/grids: default gap/gutter `var(--space-md)`; responsive breakpoints (planned): 1 col < 640px, 2 cols 640–1024px, 3 cols > 1024px (overrideable).
- Alignment: rows support left/center/right/split (space-between); stacks default to start with optional center.

Implementation (planned)
- Components/utilities:
  - `Container` applying `max-width: var(--max-width-page)` and page padding.
  - `Section` applying section padding tokens and optional `title/subtitle`, internally rendering a heading + `Stack headingAware`.
  - `Stack` applying `display: flex; flex-direction: column; gap` from tokens, with optional heading-aware gap adjustments.
  - `Row` for inline groups with configurable gap/alignment/direction.
  - `CardStack` and `CardGrid` wrappers that apply consistent gaps/gutters and responsive columns.
- Heading-aware gaps: stacks can optionally adjust the next gap based on heading level (title/secondary/tertiary), using the tokens above.

Usage (planned)
- Wrap page content in `Container`. Use `Stack` for vertical spacing; use the heading-aware option to get larger gaps after titles/subtitles. Use `Row` for inline controls with consistent gaps/alignment. Use `CardStack`/`CardGrid` to lay out multiple cards with consistent gutters and responsive columns. Keep cards marginless; outer spacing comes from these layout primitives.
