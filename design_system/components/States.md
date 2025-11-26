# States (Empty, Loading, Focus, Icons)

Empty state
- Use a consistent empty message style inside cards/tables/sections: subtle icon (optional), short headline, and concise helper text.
- Default typography: headline `var(--font-body-size)`/600, helper `var(--font-small-size)`/400, color `var(--color-text-muted)`.

Loading state
- Use a shared spinner (LoadingSpinner) or skeletons; keep container size stable.
- Spinner color: use `var(--color-accent-strong)` on light, `var(--color-accent-strong-dark)` on dark.

Focus/interactive
- Interactive pills/tabs/buttons should show focus outlines consistent with input focus (accent border/halo).
- Close icons/affordances: size ~16–18px, use `var(--color-text)` on light, `var(--color-text-dark)` on dark; hover can use slight opacity/brightness change.

Icons
- Default inline icon size: 16px–18px, with `var(--button-gap-icon)` or `var(--space-xxs)` gap from text.
- Icon color: `var(--color-text-muted)` for secondary, `var(--color-text)` for primary; swap to dark equivalents in dark mode.
