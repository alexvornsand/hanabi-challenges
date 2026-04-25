# Deferred Design Decisions

These items were explicitly deferred during the V1 design phase. They should be revisited post-V1.

---

## Cross-Event References (`event[slug]` expression)

**Context:** The DSL expression parser supports a `crossEvent` AST node (`{ kind: 'crossEvent'; slug: string; rest: ExprNode | null }`). The evaluator encounters these at runtime but cannot resolve them in V1 because there is no event history data model — snapshot data is provided per-event, not globally.

**Deferred work (post-V1):**
- Build an event history snapshot store that maps slug → `EventSnapshot`
- Wire cross-event context into the expression evaluator's `evalExpr` function

**V1 behaviour:** `crossEvent` expressions evaluate to `null` (safe fallback).

---

## `lineup_valid` Predicate

**Context:** The predicate registry includes a `lineup_valid` predicate that checks whether a scoring unit's lineup is valid at the time of a game. This requires a roster history data model — tracking team membership changes over time alongside game timestamps.

**Deferred work (post-V1):**
- Implement roster history tracking (effective-from / effective-to timestamps on `team_members`)
- Implement `lineup_valid` predicate evaluation using the roster snapshot at `game.datetime_start`

**V1 behaviour:** `lineup_valid` returns `true` for all games (permissive fallback).

---

## `lazy_trigger: 'action'` Slot Trigger

**Context:** The DSL supports `lazy_trigger: 'action'` on slots, meaning the slot is triggered by an explicit user action (e.g., a participant clicking "Start attempt"). In V1, this is treated identically to `'admin'` — the slot is issued by admin action only.

**Deferred work (post-V1):**
- Add a participant-facing "Start" endpoint that issues the lazy slot
- Wire it to the slot's `lazy_trigger` field

**V1 behaviour:** `lazy_trigger: 'action'` behaves the same as `'admin'` (admin-only issuance).

---

## `bracket_activation` Deferred Slot Trigger

**Context:** The DSL supports `trigger_type: 'bracket_activation'` for deferred slot generators, meaning slots are created when a bracket matchup becomes active. The `slotTriggerEngine` stubs this trigger type but the matchup activation event system is not implemented in V1.

**Deferred work (post-V1):**
- Implement bracket matchup activation events
- Wire `bracket_activation` triggers to fire when the relevant matchup becomes live

**V1 behaviour:** `bracket_activation` generators do not issue slots automatically.

---

## ID-based Public Event Routes

**Context:** The following routes were scaffolded but not implemented in V1. The frontend uses slug-based routes (`/api/:slug/*`) for all public access. The ID-based routes exist for API completeness but have no frontend consumer in V1.

Deferred routes:
- `GET /api/events/:id/scoreboard`
- `GET /api/events/:id/slots`
- `GET /api/events/:id/my-progress`
- `GET /api/events/:id/awards`
- `GET /api/events/:id/sections`
- `GET /api/events/:id/sections/:sectionId`

**V1 behaviour:** These routes return `501 Not Implemented`.

---

## Mobile Responsiveness

**Decision from participant-ui.md Q8:** Mobile is not a V1 concern. The platform targets desktop browsers. No responsive breakpoints, bottom sheets, or mobile-specific layout variants are implemented in V1.

**Minimum supported screen width:** Not formally specified for V1.

**Deferred work (post-V1):**
- Scoreboard: show only rank, name, primary score on narrow screens; expandable "More" row for extra columns
- Event page: stacked layout with no side-by-side panels
- Admin panel: Mantine Drawer bottom-sheet pattern on mobile
- Editor: full-screen tab layout for small screens
- Use `useMediaQuery` from Mantine for breakpoint detection

**Mitigation for V1:** No fixed-width containers. Use `overflow-x: auto` on tables (already in Scoreboard component). No content should overflow catastrophically, but explicit mobile optimization is deferred.
