# Modals

Tokens and source
- Tokens live in `frontend/src/styles/tokens.css`. Modals reuse card tokens for the shell (padding, radius, shadow, border, background) and modal-specific tokens for the overlay.
- Relevant tokens: `--modal-overlay-bg`, `--modal-overlay-blur`, `--max-width-panel`, `--space-md` (padding), `--radius-md`, `--shadow-modal`, `--color-border`, `--color-surface`, `--font-title-size`, `--font-body-size`.

Decisions (token references)
- Overlay: background `var(--modal-overlay-bg)` with blur `var(--modal-overlay-blur)`, full-viewport coverage, padding `var(--space-md)`, click-outside closes by default.
- Shell: background `var(--color-surface)` (swap to `--color-surface-dark` in dark mode), border `1px solid var(--color-border)`, radius `var(--radius-md)`, shadow `var(--shadow-modal)`, padding `var(--space-md)`, width 100% up to `var(--max-width-panel)` by default (overrideable).
- Structure: header with title + close button; body as a vertical stack with gap `var(--space-sm)`; optional footer hosting button groups (spacing handled by button-group). Title uses `var(--font-title-size)`, margin 0.
- Close affordances: header close (“×”); overlay click closes (configurable); Escape key closes (configurable for critical flows).
- Scroll/focus: lock body scroll while open; focus the modal on mount; trap focus in a follow-up implementation.

Implementation (planned)
- Component: `src/components/Modal.tsx` consuming the tokens above (shell built like a Card: shared padding/radius/shadow/border/background). Props to control `title`, `footer`, `onClose`, `width` (defaults to `var(--max-width-panel)`), and `dismissOnOverlayClick`.
- Styles: overlay and shell classes using the modal tokens and card tokens; footer expects a ButtonGroup to manage button spacing/alignment.

Usage (planned)
- Wrap modal content with `<Modal title="…" onClose={…}>…</Modal>`, optionally providing `footer`. Use ButtonGroup in footers for spacing/alignment. Overlay click and ESC close can be disabled for critical flows. Dark mode swaps surface/border tokens automatically.
