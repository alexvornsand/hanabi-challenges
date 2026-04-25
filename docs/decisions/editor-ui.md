# Editor UI Design Decisions

_Recorded from interview with user — 2026-04-25._
_These decisions govern tickets 030 (layout), 031 (feedback panel), 032 (template picker), and all editor-related tickets._

---

## Q1 — Layout: full viewport vs. dashboard with persistent chrome

**Answer:** The editor is the main content area of the page. Standard site chrome (header, navigation) is included — the editor does not occupy the full browser viewport in isolation.

**Decision:** Embed the editor as the primary `<main>` content inside the existing site layout. Navigation and header remain visible. The editor fills the remaining viewport height with a fixed-height layout (no page scroll). This is consistent with how IDEs embed in VS Code's web variant — chrome stays, editor fills.

**Downstream effect on Ticket 030:** Use a split-height layout: site header (fixed) + editor content area (fills remainder with `height: 100vh - headerHeight`). No sidebar by default; navigation is in the header.

---

## Q2 — Preview: side-by-side vs. tab/panel

**Answer:** Tab/panel structure. A third tab for the visual GUI editor is planned for the future.

**Decision:** Three-tab panel at the top of the editor content area:
1. **YAML** — CodeMirror editor (active now)
2. **Preview** — compiled event structure / scoreboard preview (active now)
3. **Visual Editor** — GUI event builder (future, placeholder tab, disabled)

Tabs are rendered using the design system tab component. The active tab controls which content panel is visible below.

**Downstream effect on Ticket 030:** Implement `<EditorTabs>` with three tabs. Visual Editor tab is present but disabled with a tooltip ("Coming soon").

---

## Q3 — Pipeline feedback: gutter only vs. gutter + panel

**Answer:** Feedback should be detailed, specific, and actionable. Follow best practices.

**Decision:** Both: gutter markers (squiggly underlines / line-level icons) in the CodeMirror editor AND a dedicated diagnostics panel below the editor, always visible when the YAML tab is active. The panel lists all diagnostics (errors and warnings) with:
- Severity badge (error / warning / notice)
- Diagnostic code (e.g., `missing_event_id`)
- Full message text
- Line/path reference where applicable
- Clicking a row scrolls the editor to the relevant line

This mirrors VS Code's "Problems" panel — the gold standard for code-editor feedback. The panel is collapsible but defaults to open whenever there are diagnostics.

**Downstream effect on Ticket 031:** Implement `<DiagnosticsPanel>` below the editor with the columns above. Wire gutter decorations in CodeMirror via the lint extension.

---

## Q4 — Warning acknowledgement: inline vs. separate publish step

**Answer:** Saving with errors is tolerated. Publishing with errors requires a modal confirmation. Distinguish breaking errors from non-breaking warnings.

**Decision:**

| State | Save | Publish |
|---|---|---|
| `canSave: false` (breaking errors) | Allowed — saves raw YAML, shows errors in diagnostics panel | Blocked — publish button disabled, tooltip explains why |
| `canSave: true, canPublish: false` (unacknowledged warnings) | Allowed | Triggers confirmation modal listing unacknowledged warnings; user must check each one before confirming |
| `canSave: true, canPublish: true` | Allowed | Proceeds immediately |

The confirmation modal (for warnings) shows each warning's code and message with a checkbox. Checking all boxes enables the "Publish" button inside the modal. Checking is not persisted until the user confirms — at which point the server's `POST /acknowledge-warning` is called for each, then `POST /publish`.

**Downstream effect on Ticket 031:** Implement `<PublishModal>` with per-warning checkboxes. Disable the publish button (not hide it) when `canSave: false`.

---

## Q5 — Template picker: modal vs. full page vs. inline panel

**Answer:** Modal.

**Decision:** When the organiser navigates to "New Event", a modal opens listing the available YAML templates (returned by `GET /api/admin/events/new`). Each template is a card with name, brief description, and a "Use this template" button. Selecting a template pre-populates the editor with the template YAML and closes the modal. There is also a "Start from scratch" option (blank YAML).

**Downstream effect on Ticket 032:** Implement `<TemplatePickerModal>` triggered on route `/admin/events/new`. On selection, navigate to `/admin/events/new?template=<slug>` (or pass state) and open the editor with pre-filled YAML.

---

## Q6 — Design system

**Answer:** Yes, there is an existing design system beyond Mantine. Follow it.

**Decision:** Follow the two-tier design system described in `docs/standards/design-system.md`:
- **Tier 1** — first-party components from `../design-system` (Button, Alert, Text, Input, Select, etc.) — use these in page and feature code.
- **Tier 2** — `Core*` Mantine wrappers (CoreBox, CoreText, etc.) — use in admin pages where Tier 1 components don't cover the case.
- No raw HTML elements where DS components exist.
- DS repo: `/Users/alexvornsand/Documents/Github/design-system` — consult for component inventory before creating new components.

---

## Q7 — Theme: light / dark / both

**Answer:** Both, per the site-wide design system.

**Decision:** Implement both light and dark modes. The web app's root must wrap content in a `ColorSchemeProvider` (or equivalent DS mechanism) that reads from user preference / system preference. All editor UI components must support both modes — do not hardcode colours; use design system tokens.

**Downstream effect on all editor tickets:** Before building any editor ticket, confirm `ColorSchemeProvider` is configured in `packages/web/src/main.tsx`. If it is not already present, add it as the first step of Ticket 030.
