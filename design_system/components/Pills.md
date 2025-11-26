# Pills / Badges

Tokens and source
- Tokens live in `frontend/src/styles/tokens.css`. Pills reference token names rather than literals.

Sizes (token references)
- Small (inline with text): padding `var(--space-xxs)` vertical, `var(--space-xs)` horizontal; font `var(--font-small-size)`; weight 600; radius `var(--radius-pill)`.
- Medium (default/KPI): padding `var(--space-xs)` vertical, `var(--space-sm)` horizontal; font `var(--font-body-size)`; weight 600; radius `var(--radius-pill)`.
- Large (header/user-pill near buttons): padding `var(--space-xs)` vertical, `var(--space-md)` horizontal; font `var(--font-body-size)`; weight 600; radius `var(--radius-pill)`.

Colors (light/dark)
- Default: bg `var(--color-surface-muted)` / `--color-surface-muted-dark`; text `var(--color-text)` / `--color-text-dark`; border `var(--color-border)` / `--color-border-dark`.
- Accent: bg `var(--color-accent-weak)` / `--color-accent-weak-dark`; text `var(--color-accent-strong)` / `--color-accent-strong-dark`; border matches bg variant.
- Action/interactive pills: inherit button hover/active affordances (darken on hover/active, disabled opacity) while keeping pill shape and padding tokens.

Layout/gaps
- Row gap between pills: `var(--space-xs)`; allow wrapping when space is constrained.
- Icon/avatar gap inside a pill: `var(--space-xxs)`.

Implementation (planned)
- Component: `src/components/Pill.tsx` with size variants (sm/md/lg) and color variants (default/accent), applying the tokens above.
- Component/utility: `PillRow` to lay out pills with gap `var(--space-xs)` and wrapping.
- Interactive pills/buttons will reuse the button state styles (hover/active/disabled) and button text color tokens, keeping pill padding/radius.

Usage (planned)
- Use size variants based on context: small for inline text, medium for KPIs/default, large for header/user chips. Choose color variant (default/accent) per semantics. Place multiple pills inside `PillRow` to get consistent spacing/wrapping.
