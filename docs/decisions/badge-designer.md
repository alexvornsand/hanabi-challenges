# Badge Designer Integration Decisions

## Q1 — Integration vs Standalone

**Decision:** Integrated. The badge is defined entirely as arguments within the event YAML. The badge designer is not a separate tool; it is part of the YAML editor experience (a live preview panel driven by the `badge:` block in the config).

No separate badge designer route or standalone tool is needed.

---

## Q2 — SVG Generation Approach

**Decision:** Rebuild the engine, using the existing `badgeSvgRenderer.ts` code as a reference starting point. The existing renderer is passable but rough. The new renderer should be a clean implementation that covers the same visual output and is designed to be extended.

**Reference code:** `apps/web/src/pages/admin/badgeSvgRenderer.ts`

The new renderer lives in the `packages/web` (or a shared package) and is driven purely by `BadgeConfig` fields from the DSL schema.

---

## Q3 — Schema Expressiveness

**Decision:** The current `BadgeConfig` schema (`shape`, `colour`, `primary_text`, `secondary_text`, `size`) covers the existing system with one omission: **`icon`**. The `icon` field (a symbol token string, e.g. `"star"`, `"emoji_events"`) is already present in the DSL `BadgeConfig` type and must be included in the YAML schema.

**Shape mapping (old renderer → new schema):**

| Old (`badgeSvgRenderer`) | New (`BadgeConfig.shape`) |
|---|---|
| `circle`            | `circle`  |
| `rounded-square`    | `shield`  |
| `rounded-hexagon`   | `hex`     |
| `diamond-facet`     | `ribbon`  |
| `rosette`           | `star`    |

The schema is expected to expand over time. The old tier system (gold/silver/bronze/participant) maps to `colour: ColourToken` in the new schema.

**Downstream impact:**
- Ticket 056: rebuild `badgeSvgRenderer` as a new engine driven by `BadgeConfig`; keep icon path lookup (`symbolTokenToPath`) from the old renderer as a starting point.

---

## Q4 — Custom SVG Import

**Decision:** Not part of the vision. Config-only: all badge visuals are generated from `BadgeConfig` fields. Existing SVG files from the old badge designer are not importable as assets.
